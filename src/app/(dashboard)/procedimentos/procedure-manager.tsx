'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Clock3, Edit3, LoaderCircle, Plus, RotateCcw, Sparkles, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { centsToPriceInput, procedureFormSchema, type ProcedureFormValues } from '@/features/procedures/schema';
import { saveProcedure, setProcedureActive } from './actions';
import type { Procedure } from '@/types/database';

const emptyForm: ProcedureFormValues = {
  name: '', category: '', description: '', price: '', durationMinutes: '60', returnIntervalDays: '',
  requiresReturnConfirmation: true, active: true,
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function toFormValues(procedure: Procedure): ProcedureFormValues {
  return {
    id: procedure.id,
    name: procedure.name,
    category: procedure.category,
    description: procedure.description ?? '',
    price: centsToPriceInput(procedure.price_cents),
    durationMinutes: String(procedure.duration_minutes),
    returnIntervalDays: procedure.return_interval_days ? String(procedure.return_interval_days) : '',
    requiresReturnConfirmation: procedure.requires_return_confirmation,
    active: procedure.active,
  };
}

export function ProcedureManager({ procedures }: { procedures: Procedure[] }) {
  const [editing, setEditing] = useState<Procedure | null | 'new'>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ProcedureFormValues>({ resolver: zodResolver(procedureFormSchema), defaultValues: emptyForm });

  useEffect(() => {
    if (editing === 'new') form.reset(emptyForm);
    else if (editing) form.reset(toFormValues(editing));
  }, [editing, form]);

  const activeCount = procedures.filter((item) => item.active).length;

  function submit(values: ProcedureFormValues) {
    setNotice(null);
    startTransition(async () => {
      const result = await saveProcedure(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, message]) => form.setError(field as keyof ProcedureFormValues, { message }));
        }
        setNotice({ kind: 'error', text: result.message });
        return;
      }
      setEditing(null);
      setNotice({ kind: 'success', text: result.message });
    });
  }

  function changeStatus(procedure: Procedure) {
    setNotice(null);
    startTransition(async () => {
      const result = await setProcedureActive(procedure.id, !procedure.active);
      setNotice({ kind: result.ok ? 'success' : 'error', text: result.message });
    });
  }

  return <>
    <div className="procedure-toolbar">
      <div><strong>{activeCount}</strong><span>{activeCount === 1 ? 'procedimento ativo' : 'procedimentos ativos'}</span></div>
      <Button type="button" onClick={() => { setNotice(null); setEditing('new'); }}><Plus size={17} /> Novo procedimento</Button>
    </div>

    {notice && <p className={`alert ${notice.kind === 'error' ? 'error' : 'success'}`} role="status">{notice.text}</p>}

    {procedures.length === 0 ? <section className="procedure-empty">
      <span><Sparkles size={27} /></span><h2>Comece pelo seu primeiro procedimento</h2>
      <p>Cadastre seus serviços com valor, duração e previsão de retorno. Este catálogo pertence somente à sua conta.</p>
      <Button type="button" onClick={() => setEditing('new')}><Plus size={17} /> Cadastrar procedimento</Button>
    </section> : <div className="procedure-grid">
      {procedures.map((procedure) => <article className={`procedure-card ${procedure.active ? '' : 'inactive'}`} key={procedure.id}>
        <div className="procedure-card-top"><span className="category-badge">{procedure.category}</span><span className={`state-badge ${procedure.active ? 'active' : ''}`}>{procedure.active ? 'Ativo' : 'Inativo'}</span></div>
        <h2>{procedure.name}</h2>
        <p className="procedure-description">{procedure.description || 'Sem descrição.'}</p>
        <div className="procedure-meta"><strong>{money.format(procedure.price_cents / 100)}</strong><span><Clock3 size={15} /> {procedure.duration_minutes} min</span>{procedure.return_interval_days && <span><RotateCcw size={15} /> {procedure.return_interval_days} dias</span>}</div>
        {procedure.return_interval_days && procedure.requires_return_confirmation && <p className="confirmation-note">Retorno sujeito à confirmação profissional</p>}
        <div className="procedure-actions"><button type="button" onClick={() => { setNotice(null); setEditing(procedure); }} disabled={pending}><Edit3 size={16} /> Editar</button><button type="button" onClick={() => changeStatus(procedure)} disabled={pending}>{procedure.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}{procedure.active ? 'Desativar' : 'Ativar'}</button></div>
      </article>)}
    </div>}

    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setEditing(null); }}>
      <section className="procedure-modal" role="dialog" aria-modal="true" aria-labelledby="procedure-form-title">
        <div className="modal-heading"><div><span className="overline">MEU CATÁLOGO</span><h2 id="procedure-form-title">{editing === 'new' ? 'Novo procedimento' : 'Editar procedimento'}</h2><p>As informações ficam vinculadas somente à sua conta.</p></div><button type="button" className="modal-close" onClick={() => setEditing(null)} disabled={pending} aria-label="Fechar"><X size={20} /></button></div>
        <form className="procedure-form" onSubmit={form.handleSubmit(submit)} noValidate>
          <div className="form-row two"><FormField label="Nome do procedimento" error={form.formState.errors.name?.message}><input {...form.register('name')} maxLength={120} placeholder="Ex.: Volume brasileiro" autoFocus /></FormField><FormField label="Categoria" error={form.formState.errors.category?.message}><input {...form.register('category')} maxLength={80} placeholder="Ex.: Cílios" /></FormField></div>
          <FormField label="Descrição curta (opcional)" error={form.formState.errors.description?.message}><textarea {...form.register('description')} maxLength={500} rows={3} placeholder="Uma breve descrição para identificar o serviço" /></FormField>
          <div className="form-row three"><FormField label="Valor padrão (R$)" error={form.formState.errors.price?.message}><input {...form.register('price')} inputMode="decimal" placeholder="150,00" /></FormField><FormField label="Duração (minutos)" error={form.formState.errors.durationMinutes?.message}><input {...form.register('durationMinutes')} inputMode="numeric" /></FormField><FormField label="Retorno sugerido (dias)" hint="Opcional" error={form.formState.errors.returnIntervalDays?.message}><input {...form.register('returnIntervalDays')} inputMode="numeric" placeholder="Ex.: 21" /></FormField></div>
          <label className="check-field"><input type="checkbox" {...form.register('requiresReturnConfirmation')} /><span><strong>Confirmar o retorno com a profissional</strong><small>Recomendado para procedimentos que não possuem intervalo universal.</small></span></label>
          <label className="check-field compact"><input type="checkbox" {...form.register('active')} /><span><strong>Procedimento ativo</strong><small>Disponível para futuros agendamentos.</small></span></label>
          {notice?.kind === 'error' && <p className="alert error" role="alert">{notice.text}</p>}
          <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={pending}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={17} /> Salvando…</> : editing === 'new' ? 'Cadastrar procedimento' : 'Salvar alterações'}</Button></div>
        </form>
      </section>
    </div>}
  </>;
}

function FormField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <label className="form-field"><span>{label}{hint && <small>{hint}</small>}</span>{children}{error && <em role="alert">{error}</em>}</label>;
}
