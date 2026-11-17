'use client';

import { useState, useTransition } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Clock3, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OpenReceivableRow } from '@/features/finances/dashboard';
import { formatMoney, paymentFormSchema, type PaymentFormValues } from '@/features/finances/schema';
import { registerPayment } from './actions';
import { FinancialAccountPanel, FinancialAccountRow, FinancialField, FinancialModal, FinancialPaymentMethodOptions, financialToday, formatFinancialDate } from './financial-account-ui';
import { FinancialCancellationModal, type FinancialCancellationTarget } from './financial-cancellation-modal';

const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

export function AccountsReceivablePanel({ items }: { items: OpenReceivableRow[] }) {
  const [selected, setSelected] = useState<OpenReceivableRow | null>(null);
  const [cancellation, setCancellation] = useState<FinancialCancellationTarget | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { receivableId: '', amount: '', paidAt: financialToday, paymentMethod: 'pix', notes: '' },
  });

  function openPayment(item: OpenReceivableRow) {
    setNotice(null);
    setSelected(item);
    form.reset({ receivableId: item.id, amount: centsToInput(item.balance_cents), paidAt: financialToday, paymentMethod: 'pix', notes: '' });
  }

  function submit(values: PaymentFormValues) {
    startTransition(async () => {
      const result = await registerPayment(values);
      if (!result.ok) {
        if (result.fieldErrors) Object.entries(result.fieldErrors).forEach(([field, message]) => form.setError(field as keyof PaymentFormValues, { message }));
        setNotice({ kind: 'error', text: result.message });
        return;
      }
      setSelected(null);
      setNotice({ kind: 'success', text: result.message });
    });
  }

  return <>
    <FinancialAccountPanel overline="CONTAS A RECEBER" title="Recebimentos pendentes da sua carteira" count={items.length} emptyText="Você não possui contas a receber em aberto." notice={notice}>
      {items.map((item) => <FinancialAccountRow
        key={item.id}
        icon={<Clock3 size={18} />}
        overdue={item.due_date < financialToday}
        title={item.description}
        detail={<>{item.client_name || 'Sem cliente vinculada'} · Vence em {formatFinancialDate(item.due_date)}</>}
        values={<><small>Total {formatMoney(item.amount_cents)}</small><strong>{formatMoney(item.balance_cents)}</strong><span>saldo aberto</span></>}
        actionLabel="Registrar recebimento"
        onAction={() => openPayment(item)}
        secondaryActionLabel="Cancelar"
        onSecondaryAction={() => setCancellation({ id: item.id, type: 'receivable', description: item.description })}
      />)}
    </FinancialAccountPanel>

    {selected && <FinancialModal labelledBy="payment-title" overline="ENTRADA FINANCEIRA" title="Registrar recebimento" description={<>{selected.description} · saldo de {formatMoney(selected.balance_cents)}</>} pending={pending} onClose={() => setSelected(null)}>
      <form className="procedure-form" onSubmit={form.handleSubmit(submit)} noValidate>
        <input type="hidden" {...form.register('receivableId')} />
        <div className="form-row three">
          <FinancialField label="Valor recebido (R$)" error={form.formState.errors.amount?.message}><input {...form.register('amount')} inputMode="decimal" aria-describedby="payment-balance" /></FinancialField>
          <FinancialField label="Data do recebimento" error={form.formState.errors.paidAt?.message}><input type="date" {...form.register('paidAt')} /></FinancialField>
          <FinancialField label="Forma de pagamento" error={form.formState.errors.paymentMethod?.message}><select {...form.register('paymentMethod')}><FinancialPaymentMethodOptions /></select></FinancialField>
        </div>
        <p className="payment-balance" id="payment-balance">O valor não pode ultrapassar {formatMoney(selected.balance_cents)}.</p>
        <FinancialField label="Observações" hint="Opcional" error={form.formState.errors.notes?.message}><textarea {...form.register('notes')} rows={3} /></FinancialField>
        {notice?.kind === 'error' && <p className="alert error">{notice.text}</p>}
        <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setSelected(null)} disabled={pending}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={17}/> Salvando…</> : 'Confirmar recebimento'}</Button></div>
      </form>
    </FinancialModal>}
    {cancellation && <FinancialCancellationModal target={cancellation} onClose={() => setCancellation(null)} onSuccess={(message) => { setCancellation(null); setNotice({ kind: 'success', text: message }); }} />}
  </>;
}
