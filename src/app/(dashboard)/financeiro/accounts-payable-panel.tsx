'use client';

import { useState, useTransition } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CheckCircle2, LoaderCircle, ReceiptText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OpenExpenseRow } from '@/features/finances/dashboard';
import { expenseSettlementFormSchema, formatMoney, paymentMethods, type ExpenseSettlementFormValues } from '@/features/finances/schema';
import { settleExpense } from './actions';

const today = new Date().toISOString().slice(0, 10);
const methodLabels: Record<string, string> = { pix: 'PIX', cash: 'Dinheiro', debit_card: 'Cartão de débito', credit_card: 'Cartão de crédito', transfer: 'Transferência', other: 'Outros' };
const formatDate = (date: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

export function AccountsPayablePanel({ items }: { items: OpenExpenseRow[] }) {
  const [selected, setSelected] = useState<OpenExpenseRow | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ExpenseSettlementFormValues>({
    resolver: zodResolver(expenseSettlementFormSchema),
    defaultValues: { expenseId: '', paidAt: today, paymentMethod: 'pix' },
  });

  function openSettlement(item: OpenExpenseRow) {
    setNotice(null);
    setSelected(item);
    form.reset({ expenseId: item.id, paidAt: today, paymentMethod: 'pix' });
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
    <section className="receivables-card payables-card">
      <div className="chart-heading">
        <div><span className="overline">CONTAS A PAGAR</span><h2>Gastos pendentes sob sua responsabilidade</h2></div>
        <span>{items.length} {items.length === 1 ? 'conta aberta' : 'contas abertas'}</span>
      </div>
      {notice && <p className={`alert ${notice.kind}`} role="status">{notice.text}</p>}
      {items.length ? <div className="receivable-list">{items.map((item) => {
        const overdue = item.due_date < today;
        return <article className="receivable-row" key={item.id}>
          <span className={`receivable-icon expense ${overdue ? 'overdue' : ''}`}><ReceiptText size={18} /></span>
          <div className="receivable-main"><strong>{item.description}</strong><small>{item.category} · Vence em {formatDate(item.due_date)} · {item.responsibility === 'shared' ? 'Clínica' : 'Individual'}</small></div>
          <div className="receivable-values"><strong>{formatMoney(item.amount_cents)}</strong><span>{item.status === 'planned' ? 'prevista' : 'pendente'}</span></div>
          <Button variant="outline" onClick={() => openSettlement(item)}>Registrar pagamento</Button>
        </article>;
      })}</div> : <div className="receivables-empty"><CheckCircle2 size={28} /><p>Você não possui contas a pagar em aberto.</p></div>}
    </section>

    {selected && <div className="modal-backdrop" role="presentation"><section className="procedure-modal finance-modal" role="dialog" aria-modal="true" aria-labelledby="settlement-title">
      <div className="modal-heading"><div><span className="overline">SAÍDA FINANCEIRA</span><h2 id="settlement-title">Quitar conta a pagar</h2><p>{selected.description} · {formatMoney(selected.amount_cents)}</p></div><button className="modal-close" onClick={() => setSelected(null)} disabled={pending} aria-label="Fechar"><X size={20}/></button></div>
      <form className="procedure-form" onSubmit={form.handleSubmit(submit)} noValidate>
        <input type="hidden" {...form.register('expenseId')} />
        <div className="form-row two">
          <Field label="Data do pagamento" error={form.formState.errors.paidAt?.message}><input type="date" {...form.register('paidAt')} /></Field>
          <Field label="Forma de pagamento" error={form.formState.errors.paymentMethod?.message}><select {...form.register('paymentMethod')}>{paymentMethods.map((method) => <option value={method} key={method}>{methodLabels[method]}</option>)}</select></Field>
        </div>
        <p className="payment-balance">A quitação registrará uma saída de caixa integral de {formatMoney(selected.amount_cents)}.</p>
        {notice?.kind === 'error' && <p className="alert error">{notice.text}</p>}
        <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setSelected(null)} disabled={pending}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={17}/> Salvando…</> : 'Confirmar pagamento'}</Button></div>
      </form>
    </section></div>}
  </>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}{error && <em>{error}</em>}</label>;
}
