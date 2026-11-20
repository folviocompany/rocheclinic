'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clientFormSchema, formatPhone, type ClientFormValues } from '@/features/clients/schema';
import type { ClientListItem } from '@/features/clients/data-access';
import { saveClient } from './actions';
import type { ProfessionalOption } from './client-manager';

const emptyForm: ClientFormValues = { fullName: '', phone: '', birthDate: '', referenceProfessionalId: '', notes: '', whatsappAllowed: false, active: true };

function toFormValues(client: ClientListItem): ClientFormValues {
  return { id: client.id, fullName: client.full_name, phone: formatPhone(client.phone_digits), birthDate: client.birth_date ?? '', referenceProfessionalId: client.reference_professional_id ?? '', notes: client.notes ?? '', whatsappAllowed: client.whatsapp_allowed, active: client.active };
}

export function ClientFormModal({ client, professionals, onClose, onResult }: { client: ClientListItem | null; professionals: ProfessionalOption[]; onClose: () => void; onResult: (result: { kind: 'success' | 'error'; text: string }) => void }) {
  const [pending, startTransition] = useTransition();
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const form = useForm<ClientFormValues>({ resolver: zodResolver(clientFormSchema), defaultValues: client ? toFormValues(client) : emptyForm });

  useEffect(() => form.reset(client ? toFormValues(client) : emptyForm), [client, form]);

  function submit(values: ClientFormValues) {
    setErrorNotice(null);
    startTransition(async () => {
      const result = await saveClient(values);
      if (!result.ok) {
        if (result.fieldErrors) Object.entries(result.fieldErrors).forEach(([field, message]) => form.setError(field as keyof ClientFormValues, { message }));
        setErrorNotice(result.message);
        return;
      }
      onResult({ kind: 'success', text: result.message });
    });
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}><section className="procedure-modal" role="dialog" aria-modal="true" aria-labelledby="client-form-title"><div className="modal-heading"><div><span className="overline">CADASTRO COMPARTILHADO</span><h2 id="client-form-title">{client ? 'Editar cliente' : 'Nova cliente'}</h2><p>Use apenas informações administrativas necessárias para o atendimento.</p></div><button type="button" className="modal-close" onClick={onClose} disabled={pending} aria-label="Fechar"><X size={20} /></button></div><form className="procedure-form" onSubmit={form.handleSubmit(submit)} noValidate>
    <div className="form-row two"><FormField label="Nome completo" error={form.formState.errors.fullName?.message}><input {...form.register('fullName')} maxLength={150} autoFocus /></FormField><FormField label="Telefone com DDD" error={form.formState.errors.phone?.message}><input {...form.register('phone')} inputMode="tel" placeholder="(92) 99999-9999" /></FormField></div>
    <div className="form-row two"><FormField label="Data de nascimento" hint="Opcional" error={form.formState.errors.birthDate?.message}><input {...form.register('birthDate')} type="date" max={new Date().toISOString().slice(0, 10)} /></FormField><FormField label="Profissional de referência" hint="Opcional" error={form.formState.errors.referenceProfessionalId?.message}><select {...form.register('referenceProfessionalId')}><option value="">Sem referência</option>{professionals.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.specialty}</option>)}</select></FormField></div>
    <FormField label="Observações administrativas" hint="Não inclua dados clínicos" error={form.formState.errors.notes?.message}><textarea {...form.register('notes')} maxLength={1000} rows={3} placeholder="Preferências de contato ou informações administrativas" /></FormField>
    <label className="check-field"><input type="checkbox" {...form.register('whatsappAllowed')} /><span><strong>Cliente autoriza contato pelo WhatsApp</strong><small>Registre somente quando a cliente tiver autorizado esse canal.</small></span></label>
    <label className="check-field compact"><input type="checkbox" {...form.register('active')} /><span><strong>Cadastro ativo</strong><small>Cadastros arquivados permanecem no histórico.</small></span></label>
    {errorNotice && <p className="alert error" role="alert">{errorNotice}</p>}
    <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={17} /> Salvando…</> : client ? 'Salvar alterações' : 'Cadastrar cliente'}</Button></div>
  </form></section></div>;
}

function FormField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return <label className="form-field"><span>{label}{hint && <small>{hint}</small>}</span>{children}{error && <em role="alert">{error}</em>}</label>;
}
