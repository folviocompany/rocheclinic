import { ShieldCheck } from 'lucide-react';
import { requireMember } from '@/features/auth/data-access';
import { ProcedureManager } from './procedure-manager';

export default async function ProceduresPage() {
  const { supabase, professional } = await requireMember();
  const { data, error } = await supabase
    .from('procedures')
    .select('*')
    .eq('professional_id', professional.id)
    .order('active', { ascending: false })
    .order('name');

  if (error) throw new Error('Não foi possível carregar os procedimentos.');

  return <>
    <div className="page-heading procedure-heading"><div><span className="overline">MEUS SERVIÇOS</span><h1>Procedimentos</h1><p className="muted">Organize seus serviços, valores, duração e intervalos de retorno.</p></div><div className="privacy-chip"><ShieldCheck size={18} /><span>Catálogo individual<small>{professional.specialty}</small></span></div></div>
    <ProcedureManager procedures={data ?? []} />
  </>;
}
