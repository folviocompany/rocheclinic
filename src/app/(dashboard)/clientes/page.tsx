import { UsersRound } from 'lucide-react';
import { requireMember } from '@/features/auth/data-access';
import { ClientManager } from './client-manager';

export default async function ClientsPage() {
  const { supabase } = await requireMember();
  const [{ data: clients, error }, { data: professionals }, { data: profiles }] = await Promise.all([
    supabase.from('clients').select('*').order('active', { ascending: false }).order('full_name'),
    supabase.from('professionals').select('*'),
    supabase.from('profiles').select('*').eq('active', true),
  ]);
  if (error) throw new Error('Não foi possível carregar as clientes.');
  const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const options = (professionals ?? []).map((professional) => ({ id: professional.id, name: profileNames.get(professional.user_id) ?? 'Profissional', specialty: professional.specialty }));

  return <><div className="page-heading procedure-heading"><div><span className="overline">RELACIONAMENTO</span><h1>Clientes</h1><p className="muted">Um cadastro compartilhado para acompanhar cada cliente sem duplicidade.</p></div><div className="privacy-chip"><UsersRound size={18} /><span>Cadastro compartilhado<small>Acesso das duas profissionais</small></span></div></div><ClientManager clients={clients ?? []} professionals={options} /></>;
}
