'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, CalendarDays, Edit3, LoaderCircle, MessageCircle, Plus, Search, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clientFormSchema, formatPhone, type ClientFormValues } from '@/features/clients/schema';
import { saveClient, setClientActive } from './actions';
import type { Client } from '@/types/database';

type ProfessionalOption = { id: string; name: string; specialty: string };
const emptyForm: ClientFormValues = { fullName: '', phone: '', birthDate: '', referenceProfessionalId: '', notes: '', whatsappAllowed: false, active: true };

function toFormValues(client: Client): ClientFormValues {
  return { id: client.id, fullName: client.full_name, phone: formatPhone(client.phone_digits), birthDate: client.birth_date ?? '', referenceProfessionalId: client.reference_professional_id ?? '', notes: client.notes ?? '', whatsappAllowed: client.whatsapp_allowed, active: client.active };
}

export function ClientManager({ clients, professionals }: { clients: Client[]; professionals: ProfessionalOption[] }) {
  const [query, setQuery] = useState('');
  const [professionalFilter, setProfessionalFilter] = useState('');
  const [editing, setEditing] = useState<Client | null | 'new'>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ClientFormValues>({ resolver: zodResolver(clientFormSchema), defaultValues: emptyForm });

  useEffect(() => {
    if (editing === 'new') form.reset(emptyForm);
    else if (editing) form.reset(toFormValues(editing));
  }, [editing, form]);

  const filtered = useMemo(() => {
    const term = query.toLocaleLowerCase('pt-BR').replace(/\D/g, '') || query.toLocaleLowerCase('pt-BR');
    return clients.filter((client) => {
      const queryMatch = !query || client.full_name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')) || client.phone_digits.includes(term);
      const professionalMatch = !professionalFilter || client.reference_professional_id === professionalFilter;
      return queryMatch && professionalMatch;
    });
  }, [clients, query, professionalFilter]);

  const professionalName = (id: string | null) => professionals.find((item) => item.id === id)?.name ?? 'Sem referência';

  function submit(values: ClientFormValues) {
    setNotice(null);
    startTransition(async () => {
      const result = await saveClient(values);
      if (!result.ok) {
        if (result.fieldErrors) Object.entries(result.fieldErrors).forEach(([field, message]) => form.setError(field as keyof ClientFormValues, { message }));
        setNotice({ kind: 'error', text: result.message });
        return;
      }
      setEditing(null);
      setNotice({ kind: 'success', text: result.message });
    });
  }

  function changeStatus(client: Client) {
    setNotice(null);
    startTransition(async () => {
      const result = await setClientActive(client.id, !client.active);
      setNotice({ kind: result.ok ? 'success' : 'error', text: result.message });
    });
  }

  return <>
    <div className="client-controls"><div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou telefone" aria-label="Buscar clientes" /></div><select value={professionalFilter} onChange={(event) => setProfessionalFilter(event.target.value)} aria-label="Filtrar por profissional"><option value="">Todas as profissionais</option>{professionals.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><Button onClick={() => { setNotice(null); setEditing('new'); }}><Plus size={17} /> Nova cliente</Button></div>
    {notice && <p className={`alert ${notice.kind === 'error' ? 'error' : 'success'}`} role="status">{notice.text}</p>}
    <div className="client-summary"><strong>{clients.filter((item) => item.active).length}</strong><span>clientes ativas</span><i /> <strong>{filtered.length}</strong><span>na visualização</span></div>

    {clients.length === 0 ? <section className="procedure-empty"><span><UserRound size={27} /></span><h2>Cadastre a primeira cliente</h2><p>O cadastro é compartilhado entre as duas profissionais e evita duplicidade por nome e telefone.</p><Button onClick={() => setEditing('new')}><Plus size={17} /> Cadastrar cliente</Button></section> : filtered.length === 0 ? <section className="client-no-results"><Search size={25} /><h2>Nenhuma cliente encontrada</h2><p>Revise a busca ou limpe o filtro de profissional.</p></section> : <div className="client-list">{filtered.map((client) => <article className={`client-row ${client.active ? '' : 'inactive'}`} key={client.id}><span className="client-avatar">{client.full_name.charAt(0)}</span><div className="client-identity"><h2>{client.full_name}</h2><p>{formatPhone(client.phone_digits)}</p></div><div className="client-reference"><span>Profissional de referência</span><strong>{professionalName(client.reference_professional_id)}</strong></div><div className="client-tags">{client.whatsapp_allowed && <span><MessageCircle size={14} /> WhatsApp autorizado</span>}{client.birth_date && <span><CalendarDays size={14} /> {new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${client.birth_date}T00:00:00Z`))}</span>}{!client.active && <span>Arquivada</span>}</div><div className="client-actions"><button onClick={() => { setNotice(null); setEditing(client); }} disabled={pending} aria-label={`Editar ${client.full_name}`}><Edit3 size={17} /></button><button onClick={() => changeStatus(client)} disabled={pending} aria-label={client.active ? `Arquivar ${client.full_name}` : `Reativar ${client.full_name}`}><Archive size={17} /></button></div></article>)}</div>}

    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setEditing(null); }}><section className="procedure-modal" role="dialog" aria-modal="true" aria-labelledby="client-form-title"><div className="modal-heading"><div><span className="overline">CADASTRO COMPARTILHADO</span><h2 id="client-form-title">{editing === 'new' ? 'Nova cliente' : 'Editar cliente'}</h2><p>Use apenas informações administrativas necessárias para o atendimento.</p></div><button type="button" className="modal-close" onClick={() => setEditing(null)} disabled={pending} aria-label="Fechar"><X size={20} /></button></div><form className="procedure-form" onSubmit={form.handleSubmit(submit)} noValidate>
      <div className="form-row two"><FormField label="Nome completo" error={form.formState.errors.fullName?.message}><input {...form.register('fullName')} maxLength={150} autoFocus /></FormField><FormField label="Telefone com DDD" error={form.formState.errors.phone?.message}><input {...form.register('phone')} inputMode="tel" placeholder="(92) 99999-9999" /></FormField></div>
      <div className="form-row two"><FormField label="Data de nascimento" hint="Opcional" error={form.formState.errors.birthDate?.message}><input {...form.register('birthDate')} type="date" max={new Date().toISOString().slice(0, 10)} /></FormField><FormField label="Profissional de referência" hint="Opcional" error={form.formState.errors.referenceProfessionalId?.message}><select {...form.register('referenceProfessionalId')}><option value="">Sem referência</option>{professionals.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.specialty}</option>)}</select></FormField></div>
      <FormField label="Observações administrativas" hint="Não inclua dados clínicos" error={form.formState.errors.notes?.message}><textarea {...form.register('notes')} maxLength={1000} rows={3} placeholder="Preferências de contato ou informações administrativas" /></FormField>
      <label className="check-field"><input type="checkbox" {...form.register('whatsappAllowed')} /><span><strong>Cliente autoriza contato pelo WhatsApp</strong><small>Registre somente quando a cliente tiver autorizado esse canal.</small></span></label>
      <label className="check-field compact"><input type="checkbox" {...form.register('active')} /><span><strong>Cadastro ativo</strong><small>Cadastros arquivados permanecem no histórico.</small></span></label>
      {notice?.kind === 'error' && <p className="alert error" role="alert">{notice.text}</p>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={pending}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={17} /> Salvando…</> : editing === 'new' ? 'Cadastrar cliente' : 'Salvar alterações'}</Button></div>
    </form></section></div>}
  </>;
}

function FormField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <label className="form-field"><span>{label}{hint && <small>{hint}</small>}</span>{children}{error && <em role="alert">{error}</em>}</label>;
}
