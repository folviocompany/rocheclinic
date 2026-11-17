'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireMember } from '@/features/auth/data-access';
import { priceToCents, procedureFormSchema, type ProcedureFormValues } from '@/features/procedures/schema';

export type ProcedureActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<Record<keyof ProcedureFormValues, string>>;
};

function validationFailure(error: z.ZodError): ProcedureActionResult {
  const fieldErrors: Partial<Record<keyof ProcedureFormValues, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !fieldErrors[field as keyof ProcedureFormValues]) {
      fieldErrors[field as keyof ProcedureFormValues] = issue.message;
    }
  }
  return { ok: false, message: 'Revise os campos destacados.', fieldErrors };
}

export async function saveProcedure(input: ProcedureFormValues): Promise<ProcedureActionResult> {
  const parsed = procedureFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { supabase, professional } = await requireMember();
  const values = parsed.data;
  const payload = {
    name: values.name,
    category: values.category,
    description: values.description || null,
    price_cents: priceToCents(values.price),
    duration_minutes: Number(values.durationMinutes),
    return_interval_days: values.returnIntervalDays ? Number(values.returnIntervalDays) : null,
    requires_return_confirmation: values.requiresReturnConfirmation,
    active: values.active,
  };

  if (values.id) {
    const { data, error } = await supabase
      .from('procedures')
      .update(payload)
      .eq('id', values.id)
      .eq('professional_id', professional.id)
      .select('id')
      .maybeSingle();

    if (error?.code === '23505') return { ok: false, message: 'Já existe um procedimento com esse nome.' };
    if (error || !data) return { ok: false, message: 'Não foi possível atualizar este procedimento.' };
  } else {
    const { error } = await supabase.from('procedures').insert({ ...payload, professional_id: professional.id });
    if (error?.code === '23505') return { ok: false, message: 'Já existe um procedimento com esse nome.' };
    if (error) return { ok: false, message: 'Não foi possível cadastrar o procedimento.' };
  }

  revalidatePath('/procedimentos');
  return { ok: true, message: values.id ? 'Procedimento atualizado.' : 'Procedimento cadastrado.' };
}

export async function setProcedureActive(id: string, active: boolean): Promise<ProcedureActionResult> {
  const validId = zId.safeParse(id);
  if (!validId.success) return { ok: false, message: 'Procedimento inválido.' };

  const { supabase, professional } = await requireMember();
  const { data, error } = await supabase
    .from('procedures')
    .update({ active })
    .eq('id', validId.data)
    .eq('professional_id', professional.id)
    .select('id')
    .maybeSingle();

  if (error || !data) return { ok: false, message: 'Não foi possível alterar o status.' };
  revalidatePath('/procedimentos');
  return { ok: true, message: active ? 'Procedimento ativado.' : 'Procedimento desativado.' };
}

const zId = z.uuid();
