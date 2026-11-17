'use client';

import { useState, useTransition } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CheckCircle2, Clock3, LoaderCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OpenReceivableRow } from '@/features/finances/dashboard';
import { formatMoney, paymentFormSchema, paymentMethods, type PaymentFormValues } from '@/features/finances/schema';
import { registerPayment } from './actions';

const today = new Date().toISOString().slice(0, 10);
const methodLabels: Record<string, string> = { pix: 'PIX', cash: 'Dinheiro', debit_card: 'Cartão de débito', credit_card: 'Cartão de crédito', transfer: 'Transferência', other: 'Outros' };
const formatDate = (date: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

export function AccountsReceivablePanel({ items }: { items: OpenReceivableRow[] }) {
  const [selected, setSelected] = useState<OpenReceivableRow | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { receivableId: '', amount: '', paidAt: today, paymentMethod: 'pix', notes: '' },
  });

  function openPayment(item: OpenReceivableRow) {
    setNotice(null);
    setSelected(item);
    form.reset({ receivableId: item.id, amount: centsToInput(item.balance_cents), paidAt: today, paymentMethod: 'pix', notes: '' });
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
    <section className="receivables-card">
      <div className="chart-heading">
        <div><span className="overline">CONTAS A RECEBER</span><h2>Recebimentos pendentes da sua carteira</h2></div>
        <span>{items.length} {items.length === 1 ? 'conta aberta' : 'contas abertas'}</span>
      </div>
      {notice && <p className={`alert ${notice.kind}`} role="status">{notice.text}</p>}
      {items.length ? <div className="receivable-list">{items.map((item) => {
        const overdue = item.due_date < today;
        return <article className="receivable-row" key={item.id}>
          <span className={`receivable-icon ${overdue ? 'overdue' : ''}`}><Clock3 size={18} /></span>
          <div className="receivable-main"><strong>{item.description}</strong><small>{item.client_name || 'Sem cliente vinculada'} · Vence em {formatDate(item.due_date)}</small></div>
          <div className="receivable-values"><small>Total {formatMoney(item.amount_cents)}</small><strong>{formatMoney(item.balance_cents)}</strong><span>saldo aberto</span></div>
          <Button variant="outline" onClick={() => openPayment(item)}>Registrar recebimento</Button>
        </article>;
      })}</div> : <div className="receivables-empty"><CheckCircle2 size={28} /><p>Você não possui contas a receber em aberto.</p></div>}
    </section>

    {selected && <div className="modal-backdrop" role="presentation"><section className="procedure-modal finance-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">
      <div className="modal-heading"><div><span className="overline">ENTRADA FINANCEIRA</span><h2 id="payment-title">Registrar recebimento</h2><p>{selected.description} · saldo de {formatMoney(selected.balance_cents)}</p></div><button className="modal-close" onClick={() => setSelected(null)} disabled={pending} aria-label="Fechar"><X size={20}/></button></div>
      <form className="procedure-form" onSubmit={form.handleSubmit(submit)} noValidate>
        <input type="hidden" {...form.register('receivableId')} />
        <div className="form-row three">
          <Field label="Valor recebido (R$)" error={form.formState.errors.amount?.message}><input {...form.register('amount')} inputMode="decimal" aria-describedby="payment-balance" /></Field>
          <Field label="Data do recebimento" error={form.formState.errors.paidAt?.message}><input type="date" {...form.register('paidAt')} /></Field>
          <Field label="Forma de pagamento" error={form.formState.errors.paymentMethod?.message}><select {...form.register('paymentMethod')}>{paymentMethods.map((method) => <option value={method} key={method}>{methodLabels[method]}</option>)}</select></Field>
        </div>
        <p className="payment-balance" id="payment-balance">O valor não pode ultrapassar {formatMoney(selected.balance_cents)}.</p>
        <Field label="Observações" hint="Opcional" error={form.formState.errors.notes?.message}><textarea {...form.register('notes')} rows={3} /></Field>
        {notice?.kind === 'error' && <p className="alert error">{notice.text}</p>}
        <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setSelected(null)} disabled={pending}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={17}/> Salvando…</> : 'Confirmar recebimento'}</Button></div>
      </form>
    </section></div>}
  </>;
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <label className="form-field"><span>{label}{hint && <small>{hint}</small>}</span>{children}{error && <em>{error}</em>}</label>;
}
