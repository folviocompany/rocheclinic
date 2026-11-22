'use client';

import { useState, useTransition } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { LoaderCircle, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OpenExpenseRow } from '@/features/finances/dashboard';
import { expenseSettlementFormSchema, formatMoney, type ExpenseSettlementFormValues } from '@/features/finances/schema';
import { settleExpense } from './actions';
import { FinancialAccountPanel, FinancialAccountRow, FinancialField, FinancialModal, FinancialPaymentMethodOptions, financialToday, formatFinancialDate } from './financial-account-ui';
import { FinancialCancellationModal, type FinancialCancellationTarget } from './financial-cancellation-modal';

export function AccountsPayablePanel({ items }: { items: OpenExpenseRow[] }) {
  const [selected, setSelected] = useState<OpenExpenseRow | null>(null);
  const [cancellation, setCancellation] = useState<FinancialCancellationTarget | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ExpenseSettlementFormValues>({
    resolver: zodResolver(expenseSettlementFormSchema),
    defaultValues: { expenseId: '', paidAt: financialToday, paymentMethod: 'pix' },
  });

  function openSettlement(item: OpenExpenseRow) {
    setNotice(null);
    setSelected(item);
    form.reset({ expenseId: item.id, paidAt: financialToday, paymentMethod: 'pix' });
  }

  function submit(values: ExpenseSettlementFormValues) {
    startTransition(async () => {
      const result = await settleExpense(values);
      if (!result.ok) {
        if (result.fieldErrors) Object.entries(result.fieldErrors).forEach(([field, message]) => form.setError(field as keyof ExpenseSettlementFormValues, { message }));
        setNotice({ kind: 'error', text: result.message });
        return;
      }
      setSelected(null);
      setNotice({ kind: 'success', text: result.message });
    });
  }

  return <>
    <FinancialAccountPanel overline="CONTAS A PAGAR" title="Gastos pendentes sob sua responsabilidade" count={items.length} emptyText="Você não possui contas a pagar em aberto." notice={notice} className="payables-card">
      {items.map((item) => <FinancialAccountRow
        key={item.id}
        icon={<ReceiptText size={18} />}
        iconClassName="expense"
        overdue={item.due_date < financialToday}
        title={item.description}
        detail={<>{item.category} · Vence em {formatFinancialDate(item.due_date)} · {item.responsibility === 'shared' ? 'Clínica' : 'Individual'}</>}
        values={<><strong>{formatMoney(item.amount_cents)}</strong><span>{item.status === 'planned' ? 'prevista' : 'pendente'}</span></>}
        actionLabel="Registrar pagamento"
        onAction={() => openSettlement(item)}
        secondaryActionLabel="Lançamento errado"
        onSecondaryAction={() => setCancellation({ id: item.id, type: 'expense', description: item.description })}
      />)}
    </FinancialAccountPanel>

    {selected && <FinancialModal labelledBy="settlement-title" overline="SAÍDA FINANCEIRA" title="Quitar conta a pagar" description={<>{selected.description} · {formatMoney(selected.amount_cents)}</>} pending={pending} onClose={() => setSelected(null)}>
      <form className="procedure-form" onSubmit={form.handleSubmit(submit)} noValidate>
        <input type="hidden" {...form.register('expenseId')} />
        <div className="form-row two">
          <FinancialField label="Data do pagamento" error={form.formState.errors.paidAt?.message}><input type="date" {...form.register('paidAt')} /></FinancialField>
          <FinancialField label="Forma de pagamento" error={form.formState.errors.paymentMethod?.message}><select {...form.register('paymentMethod')}><FinancialPaymentMethodOptions /></select></FinancialField>
        </div>
        <p className="payment-balance">A quitação registrará uma saída de caixa integral de {formatMoney(selected.amount_cents)}.</p>
        {notice?.kind === 'error' && <p className="alert error">{notice.text}</p>}
        <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setSelected(null)} disabled={pending}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={17}/> Salvando…</> : 'Confirmar pagamento'}</Button></div>
      </form>
    </FinancialModal>}
    {cancellation && <FinancialCancellationModal target={cancellation} onClose={() => setCancellation(null)} onSuccess={(message) => { setCancellation(null); setNotice({ kind: 'success', text: message }); }} />}
  </>;
}
