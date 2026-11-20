'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Archive, CalendarDays, ChevronLeft, ChevronRight, Edit3, MessageCircle, Plus, Search, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPhone } from '@/features/clients/phone';
import type { ClientListItem } from '@/features/clients/data-access';
import { setClientActive } from './actions';

const ClientFormModal = dynamic(
  () => import('./client-form-modal').then((module) => module.ClientFormModal),
  { ssr: false, loading: () => <div className="modal-backdrop"><div className="procedure-modal skeleton skeleton-card" /></div> },
);

export type ProfessionalOption = { id: string; name: string; specialty: string };

type Props = {
  clients: ClientListItem[];
  professionals: ProfessionalOption[];
  total: number;
  activeCount: number;
  page: number;
  pageCount: number;
  query: string;
  professionalId: string;
};

export function ClientManager({ clients, professionals, total, activeCount, page, pageCount, query, professionalId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = useState(query);
  const [editing, setEditing] = useState<ClientListItem | null | 'new'>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [actionPending, startAction] = useTransition();
  const [navigationPending, startNavigation] = useTransition();

  useEffect(() => setQueryInput(query), [query]);

  useEffect(() => {
    if (queryInput.trim() === query) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const value = queryInput.trim();
      if (value) params.set('q', value);
      else params.delete('q');
      params.delete('page');
      startNavigation(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [pathname, query, queryInput, router, searchParams]);

  const professionalName = (id: string | null) => professionals.find((item) => item.id === id)?.name ?? 'Sem referência';

  function updateParams(values: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(values)) {
      if (value) params.set(name, value);
      else params.delete(name);
    }
    startNavigation(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  function changeStatus(client: ClientListItem) {
    setNotice(null);
    startAction(async () => {
      const result = await setClientActive(client.id, !client.active);
      setNotice({ kind: result.ok ? 'success' : 'error', text: result.message });
    });
  }

  const hasFilters = Boolean(query || professionalId);

  return <>
    <div className="client-controls"><div className="search-box"><Search size={18} /><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Buscar por nome ou telefone" aria-label="Buscar clientes" /></div><select value={professionalId} onChange={(event) => updateParams({ professional: event.target.value, page: '' })} aria-label="Filtrar por profissional"><option value="">Todas as profissionais</option>{professionals.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><Button onClick={() => { setNotice(null); setEditing('new'); }}><Plus size={17} /> Nova cliente</Button></div>
    {navigationPending && <p className="client-loading" role="status">Atualizando clientes…</p>}
    {notice && <p className={`alert ${notice.kind === 'error' ? 'error' : 'success'}`} role="status">{notice.text}</p>}
    <div className="client-summary"><strong>{activeCount}</strong><span>clientes ativas</span><i /> <strong>{total}</strong><span>{hasFilters ? 'encontradas' : 'cadastradas'}</span></div>

    {!hasFilters && total === 0 ? <section className="procedure-empty"><span><UserRound size={27} /></span><h2>Cadastre a primeira cliente</h2><p>O cadastro é compartilhado entre as duas profissionais e evita duplicidade por nome e telefone.</p><Button onClick={() => setEditing('new')}><Plus size={17} /> Cadastrar cliente</Button></section> : clients.length === 0 ? <section className="client-no-results"><Search size={25} /><h2>Nenhuma cliente encontrada</h2><p>Revise a busca ou limpe o filtro de profissional.</p></section> : <div className={`client-list ${navigationPending ? 'is-loading' : ''}`}>{clients.map((client) => <article className={`client-row ${client.active ? '' : 'inactive'}`} key={client.id}><span className="client-avatar">{client.full_name.charAt(0)}</span><div className="client-identity"><h2>{client.full_name}</h2><p>{formatPhone(client.phone_digits)}</p></div><div className="client-reference"><span>Profissional de referência</span><strong>{professionalName(client.reference_professional_id)}</strong></div><div className="client-tags">{client.whatsapp_allowed && <span><MessageCircle size={14} /> WhatsApp autorizado</span>}{client.birth_date && <span><CalendarDays size={14} /> {new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${client.birth_date}T00:00:00Z`))}</span>}{!client.active && <span>Arquivada</span>}</div><div className="client-actions"><button onClick={() => { setNotice(null); setEditing(client); }} disabled={actionPending} aria-label={`Editar ${client.full_name}`}><Edit3 size={17} /></button><button onClick={() => changeStatus(client)} disabled={actionPending} aria-label={client.active ? `Arquivar ${client.full_name}` : `Reativar ${client.full_name}`}><Archive size={17} /></button></div></article>)}</div>}

    {total > 0 && <nav className="client-pagination" aria-label="Páginas de clientes"><button type="button" disabled={page <= 1 || navigationPending} onClick={() => updateParams({ page: String(page - 1) })}><ChevronLeft size={16} /> Anterior</button><span>Página <strong>{page}</strong> de {pageCount}</span><button type="button" disabled={page >= pageCount || navigationPending} onClick={() => updateParams({ page: String(page + 1) })}>Próxima <ChevronRight size={16} /></button></nav>}

    {editing && <ClientFormModal client={editing === 'new' ? null : editing} professionals={professionals} onClose={() => setEditing(null)} onResult={(result) => { setNotice(result); if (result.kind === 'success') setEditing(null); }} />}
  </>;
}
