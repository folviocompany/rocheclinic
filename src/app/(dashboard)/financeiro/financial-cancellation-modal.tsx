'use client';

import { useTransition } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { financialCancellationSchema, type FinancialCancellationValues } from '@/features/finances/schema';
import { cancelFinancialEntry } from './actions';
import { FinancialField, FinancialModal } from './financial-account-ui';

export type FinancialCancellationTarget = { id: string; type: 'receivable' | 'expense'; description: string };

export function FinancialCancellationModal({ target, onClose, onSuccess }: { target: FinancialCancellationTarget; onClose: () => void; onSuccess: (message: string) => void }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<FinancialCancellationValues>({
    resolver: zodResolver(financialCancellationSchema),
    defaultValues: { entryId: target.id, entryType: target.type, reason: '' },
  });

  function submit(values: FinancialCancellationValues) {
    startTransition(async () => {
      const result = await cancelFinancialEntry(values);
      if (!result.ok) {
        if (result.fieldErrors) Object.entries(result.fieldErrors).forEach(([field, message]) => form.setError(field as keyof FinancialCancellationValues, { message }));
        form.setError('reason', { message: result.message });
        return;
      }
      onSuccess(result.message);
    });
  }

  return <FinancialModal labelledBy="cancellation-title" overline="CORREÇÃO FINANCEIRA" title="Cancelar lançamento" description={target.description} pending={pending} onClose={onClose}>
    <form className="procedure-form" onSubmit={form.handleSubmit(submit)} noValidate>
      <input type="hidden" {...form.register('entryId')} />
      <input type="hidden" {...form.register('entryType')} />
      <FinancialField label="Justificativa" error={form.formState.errors.reason?.message}><textarea {...form.register('reason')} rows={4} placeholder="Explique por que este lançamento deve ser cancelado" /></FinancialField>
      <p className="payment-balance">O registro será preservado para auditoria. Lançamentos com movimentação de caixa não podem ser cancelados.</p>
      <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose} disabled={pending}>Voltar</Button><Button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={17}/> Cancelando…</> : 'Confirmar cancelamento'}</Button></div>
    </form>
  </FinancialModal>;
}
