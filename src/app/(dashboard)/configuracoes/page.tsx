import { requireMember } from '@/features/auth/data-access';
import { ShieldCheck } from 'lucide-react';
export default async function SettingsPage() {
  const { user, profile, professional, supabase } = await requireMember();
  const { data: business } = await supabase.from('business_settings').select('*').eq('id', 1).single();
  return <><div className="page-heading"><span className="overline">MEU ESPAÇO</span><h1>Minha conta</h1><p className="muted">Informações do seu acesso à rocheclinic.</p></div><section className="settings-card"><h2>Perfil profissional</h2><dl className="details"><div><dt>Nome</dt><dd>{profile.display_name}</dd></div><div><dt>E-mail de acesso</dt><dd>{user.email}</dd></div><div><dt>Área de atuação</dt><dd>{professional.specialty}</dd></div><div><dt>Clínica</dt><dd>{business?.name ?? 'Não disponível'}</dd></div><div><dt>Fuso horário</dt><dd>{business?.timezone ?? 'Não disponível'}</dd></div></dl><p className="muted small">Para alterar seus dados de acesso, entre em contato com a administração.</p></section><section className="permission-card"><ShieldCheck size={25} /><div><h3>Procedimentos vinculados à sua conta</h3><p>O catálogo será individual: cada profissional poderá gerenciar apenas seus próprios procedimentos. A agenda e o financeiro serão implementados nas próximas etapas.</p></div></section></>;
}
