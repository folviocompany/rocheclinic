'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireMember } from '@/features/auth/data-access';
import { clientFormSchema, normalizePhone, type ClientFormValues } from '@/features/clients/schema';

export type ClientActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<Record<keyof ClientFormValues, string>>;
};

function validationFailure(error: z.ZodError): ClientActionResult {
  const fieldErrors: Partial<Record<keyof ClientFormValues, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !fieldErrors[field as keyof ClientFormValues]) {
      fieldErrors[field as keyof ClientFormValues] = issue.message;
    }
  }
  return { ok: false, message: 'Revise os campos destacados.', fieldErrors };
}

export async function saveClient(input: ClientFormValues): Promise<ClientActionResult> {
  const parsed = clientFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { supabase } = await requireMember();
  const values = parsed.data;

  if (values.birthDate && values.birthDate > new Date().toISOString().slice(0, 10)) {
    return { ok: false, message: 'A data de nascimento não pode estar no futuro.', fieldErrors: { birthDate: 'Revise a data de nascimento.' } };
  }

  if (values.referenceProfessionalId) {
    const { data: professional } = await supabase.from('professionals').select('id').eq('id', values.referenceProfessionalId).maybeSingle();
    if (!professional) return { ok: false, message: 'A profissional de referência não é válida.' };
  }

  const payload = {
    full_name: values.fullName,
    phone_digits: normalizePhone(values.phone),
    birth_date: values.birthDate || null,
    reference_professional_id: values.referenceProfessionalId || null,
    notes: values.notes || null,
    whatsapp_allowed: values.whatsappAllowed,
    active: values.active,
  };

  if (values.id) {
    const { data, error } = await supabase.from('clients').update(payload).eq('id', values.id).select('id').maybeSingle();
    if (error?.code === '23505') return { ok: false, message: 'Esta cliente já está cadastrada com o mesmo telefone.' };
    if (error || !data) return { ok: false, message: 'Não foi possível atualizar esta cliente.' };
  } else {
    const { error } = await supabase.from('clients').insert(payload);
    if (error?.code === '23505') return { ok: false, message: 'Esta cliente já está cadastrada com o mesmo telefone.' };
    if (error) return { ok: false, message: 'Não foi possível cadastrar a cliente.' };
  }

  revalidatePath('/clientes');
  return { ok: true, message: values.id ? 'Cliente atualizada.' : 'Cliente cadastrada.' };
}

export async function setClientActive(id: string, active: boolean): Promise<ClientActionResult> {
  const validId = z.uuid().safeParse(id);
  if (!validId.success) return { ok: false, message: 'Cliente inválida.' };
  const { supabase } = await requireMember();
  const { data, error } = await supabase.from('clients').update({ active }).eq('id', validId.data).select('id').maybeSingle();
  if (error || !data) return { ok: false, message: 'Não foi possível alterar o status.' };
  revalidatePath('/clientes');
  return { ok: true, message: active ? 'Cliente reativada.' : 'Cliente arquivada.' };
}
