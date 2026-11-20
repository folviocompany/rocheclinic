import { UsersRound } from 'lucide-react';
import { requireMember } from '@/features/auth/data-access';
import { getClientsPage } from '@/features/clients/data-access';
import { clientListQuery } from '@/features/clients/query';
import { ClientManager } from './client-manager';

export default async function ClientsPage({ searchParams }: PageProps<'/clientes'>) {
  const filters = clientListQuery(await searchParams);
  const { supabase } = await requireMember();
  const [clientPage, { data: professionals }, { data: profiles }] = await Promise.all([
    getClientsPage(filters),
    supabase.from('professionals').select('id,user_id,specialty'),
    supabase.from('profiles').select('id,display_name').eq('active', true),
  ]);
  const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const options = (professionals ?? []).map((professional) => ({ id: professional.id, name: profileNames.get(professional.user_id) ?? 'Profissional', specialty: professional.specialty }));

  return <><div className="page-heading procedure-heading"><div><span className="overline">RELACIONAMENTO</span><h1>Clientes</h1><p className="muted">Um cadastro compartilhado para acompanhar cada cliente sem duplicidade.</p></div><div className="privacy-chip"><UsersRound size={18} /><span>Cadastro compartilhado<small>Acesso das duas profissionais</small></span></div></div><ClientManager {...clientPage} query={filters.query} professionalId={filters.professionalId} professionals={options} /></>;
}
