'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReversibleEntry } from '@/features/finances/dashboard';
import { financialReopenSchema, financialReversalSchema, formatMoney, type FinancialReopenValues, type FinancialReversalValues } from '@/features/finances/schema';
import { reopenFinancialEntry, reverseFinancialEntry } from './actions';
import { FinancialField, FinancialModal, financialToday } from './financial-account-ui';

export function FinancialReversalPanel({ entries, reopenable }: { entries: ReversibleEntry[]; reopenable: Array<{ id: string; entry_type: 'receivable' | 'expense'; description: string }> }) {
  const [open, setOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<FinancialReversalValues>({ resolver: zodResolver(financialReversalSchema), defaultValues: { entryId: '', entryType: 'receivable', reversalType: 'correction', effectiveDate: financialToday, reason: '' } });
  const reopenForm = useForm<FinancialReopenValues>({ resolver: zodResolver(financialReopenSchema), defaultValues: { entryId: '', entryType: 'receivable', reason: '' } });

  function selectEntry(id: string) {
    const entry = entries.find((item) => item.id === id);
    if (entry) form.setValue('entryType', entry.entry_type);
  }
  function submit(values: FinancialReversalValues) {
    startTransition(async () => {
      const result = await reverseFinancialEntry(values);
      if (!result.ok) { form.setError('reason', { message: result.message }); return; }
      setOpen(false); setNotice(result.message);
    });
  }
  function submitReopen(values: FinancialReopenValues) { startTransition(async () => { const result = await reopenFinancialEntry(values); if (!result.ok) { reopenForm.setError('reason', { message: result.message }); return; } setReopenOpen(false); setNotice(result.message); }); }

  return <>
    <section className="reversal-card"><div><span className="overline">CORREÇÕES DE CAIXA</span><h2>Estornos financeiros</h2><p>Corrija um registro lançado por engano ou registre uma devolução real.</p>{notice && <p className="alert success">{notice}</p>}</div><div className="financial-account-actions"><Button variant="outline" disabled={!reopenable.length} onClick={() => { reopenForm.reset({ entryId: '', entryType: 'receivable', reason: '' }); setReopenOpen(true); }}>Reabrir conta</Button><Button variant="outline" disabled={!entries.length} onClick={() => { form.reset({ entryId: '', entryType: 'receivable', reversalType: 'correction', effectiveDate: financialToday, reason: '' }); setOpen(true); }}><RotateCcw size={17}/> Novo estorno</Button></div></section>
    {open && <FinancialModal labelledBy="reversal-title" overline="ESTORNO AUDITÁVEL" title="Registrar estorno" description="Selecione o que aconteceu para manter caixa e saldo consistentes." pending={pending} onClose={() => setOpen(false)}>
      <form className="procedure-form" onSubmit={form.handleSubmit(submit)} noValidate>
        <input type="hidden" {...form.register('entryType')} />
        <div className="form-row two"><FinancialField label="Lançamento" error={form.formState.errors.entryId?.message}><select {...form.register('entryId')} onChange={(e) => { form.register('entryId').onChange(e); selectEntry(e.target.value); }}><option value="">Selecione</option>{entries.map((e) => <option key={`${e.entry_type}-${e.id}`} value={e.id}>{e.entry_type === 'receivable' ? 'Recebimento' : 'Pagamento'} · {e.description} · {formatMoney(e.amount_cents)}</option>)}</select></FinancialField><FinancialField label="O que aconteceu?" error={form.formState.errors.reversalType?.message}><select {...form.register('reversalType')}><option value="correction">Registro feito por engano</option><option value="refund">Dinheiro devolvido de verdade</option></select></FinancialField></div>
        <FinancialField label="Data efetiva" error={form.formState.errors.effectiveDate?.message}><input type="date" {...form.register('effectiveDate')} /></FinancialField>
        <FinancialField label="Justificativa" error={form.formState.errors.reason?.message}><textarea rows={4} {...form.register('reason')} /></FinancialField>
        <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={17}/> Salvando…</> : 'Confirmar estorno'}</Button></div>
      </form>
    </FinancialModal>}
    {reopenOpen && <FinancialModal labelledBy="reopen-title" overline="REABERTURA AUDITÁVEL" title="Reabrir conta" description="A conta voltará a ficar pendente sem apagar a devolução anterior." pending={pending} onClose={() => setReopenOpen(false)}><form className="procedure-form" onSubmit={reopenForm.handleSubmit(submitReopen)} noValidate><input type="hidden" {...reopenForm.register('entryType')} /><FinancialField label="Conta" error={reopenForm.formState.errors.entryId?.message}><select {...reopenForm.register('entryId')} onChange={(e) => { reopenForm.setValue('entryId', e.target.value); const item=reopenable.find(x=>x.id===e.target.value); if(item) reopenForm.setValue('entryType',item.entry_type); }}><option value="">Selecione</option>{reopenable.map(e=><option key={`${e.entry_type}-${e.id}`} value={e.id}>{e.description}</option>)}</select></FinancialField><FinancialField label="Justificativa" error={reopenForm.formState.errors.reason?.message}><textarea rows={4} {...reopenForm.register('reason')} /></FinancialField><div className="modal-actions"><Button type="button" variant="outline" onClick={()=>setReopenOpen(false)}>Cancelar</Button><Button type="submit" disabled={pending}>Confirmar reabertura</Button></div></form></FinancialModal>}
  </>;
}
