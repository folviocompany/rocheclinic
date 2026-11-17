import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { FinancialDashboardPayload } from './dashboard';

type LegacyDashboardOptions = {
  supabase: SupabaseClient<Database>;
  professionalId: string;
  start: string;
  end: string;
};

/**
 * Compatibilidade temporária para deploys em que a migration da RPC ainda não
 * chegou ao Supabase. Remover depois de confirmar a migration em produção.
 */
export async function getLegacyFinancialDashboardData({
  supabase,
  professionalId,
  start,
  end,
}: LegacyDashboardOptions): Promise<FinancialDashboardPayload> {
  const results = await Promise.all([
    supabase.from('receivables').select('id, professional_id, description, amount_cents, service_date, status').gte('service_date', start).lte('service_date', end).neq('status', 'cancelled'),
    supabase.from('payments').select('id, receivable_id, amount_cents, paid_at').gte('paid_at', start).lte('paid_at', end),
    supabase.from('expenses').select('id, description, amount_cents, competence_date, paid_at, responsibility, professional_id, status').gte('competence_date', start).lte('competence_date', end).neq('status', 'cancelled'),
    supabase.from('expenses').select('id, description, amount_cents, competence_date, paid_at, responsibility, professional_id, status').eq('status', 'paid').gte('paid_at', start).lte('paid_at', end),
    supabase.from('clients').select('id, full_name').eq('active', true).order('full_name'),
    supabase.from('procedures').select('id, professional_id, name').eq('professional_id', professionalId).eq('active', true).order('name'),
    supabase.from('professionals').select('id, user_id'),
    supabase.from('profiles').select('id, display_name').eq('active', true),
  ]);
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw new Error('Não foi possível carregar o financeiro.');

  const [receivablesResult, cashPaymentsResult, expensesResult, paidExpensesResult, clientsResult, proceduresResult, professionalsResult, profilesResult] = results;
  const receivables = receivablesResult.data ?? [];
  const cashPayments = cashPaymentsResult.data ?? [];
  const periodReceivableIds = receivables.map((item) => item.id);
  const cashParentIds = [...new Set(cashPayments.map((item) => item.receivable_id))];

  const [periodPaymentsResult, cashParentsResult] = await Promise.all([
    periodReceivableIds.length
      ? supabase.from('payments').select('receivable_id, amount_cents').in('receivable_id', periodReceivableIds)
      : Promise.resolve({ data: [], error: null }),
    cashParentIds.length
      ? supabase.from('receivables').select('id, professional_id, description').in('id', cashParentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (periodPaymentsResult.error || cashParentsResult.error) throw new Error('Não foi possível consolidar os pagamentos.');

  return {
    receivables,
    cashPayments,
    periodPayments: periodPaymentsResult.data ?? [],
    cashParents: cashParentsResult.data ?? [],
    expenses: expensesResult.data ?? [],
    paidExpenses: paidExpensesResult.data ?? [],
    clients: clientsResult.data ?? [],
    procedures: proceduresResult.data ?? [],
    professionals: professionalsResult.data ?? [],
    profiles: profilesResult.data ?? [],
  };
}
