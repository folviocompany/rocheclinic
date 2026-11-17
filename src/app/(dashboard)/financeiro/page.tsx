import { endOfMonth, format, isMatch, parseISO } from 'date-fns';
import { Landmark } from 'lucide-react';
import { requireMember } from '@/features/auth/data-access';
import { FinancialDashboard } from './financial-dashboard';

function currentManausMonth() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Manaus', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}
const sum = <T,>(items: T[], getter: (item: T) => number) => items.reduce((total, item) => total + getter(item), 0);

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ month?: string; regime?: string }> }) {
  const params = await searchParams;
  const month = params.month && isMatch(params.month, 'yyyy-MM') ? params.month : currentManausMonth();
  const regime: 'competence' | 'cash' = params.regime === 'cash' ? 'cash' : 'competence';
  const start = `${month}-01`;
  const end = format(endOfMonth(parseISO(start)), 'yyyy-MM-dd');
  const { supabase, professional } = await requireMember();

  const [receivablesResult, cashPaymentsResult, competenceExpensesResult, paidExpensesResult, clientsResult, proceduresResult, professionalsResult, profilesResult] = await Promise.all([
    supabase.from('receivables').select('*').gte('service_date', start).lte('service_date', end),
    supabase.from('payments').select('*').gte('paid_at', start).lte('paid_at', end),
    supabase.from('expenses').select('*').gte('competence_date', start).lte('competence_date', end),
    supabase.from('expenses').select('*').eq('status', 'paid').gte('paid_at', start).lte('paid_at', end),
    supabase.from('clients').select('*').eq('active', true).order('full_name'),
    supabase.from('procedures').select('*').eq('professional_id', professional.id).eq('active', true).order('name'),
    supabase.from('professionals').select('*'),
    supabase.from('profiles').select('*').eq('active', true),
  ]);
  const initialError = [receivablesResult, cashPaymentsResult, competenceExpensesResult, paidExpensesResult].find((result) => result.error)?.error;
  if (initialError) throw new Error('Não foi possível carregar o financeiro. A migration financeira pode estar pendente.');

  const receivables = (receivablesResult.data ?? []).filter((item) => item.status !== 'cancelled');
  const cashPayments = cashPaymentsResult.data ?? [];
  const competenceExpenses = (competenceExpensesResult.data ?? []).filter((item) => item.status !== 'cancelled');
  const paidExpenses = paidExpensesResult.data ?? [];
  const periodReceivableIds = receivables.map((item) => item.id);
  const cashParentIds = [...new Set(cashPayments.map((item) => item.receivable_id))];
  const [periodPaymentsResult, cashParentsResult] = await Promise.all([
    periodReceivableIds.length ? supabase.from('payments').select('*').in('receivable_id', periodReceivableIds) : Promise.resolve({ data: [], error: null }),
    cashParentIds.length ? supabase.from('receivables').select('*').in('id', cashParentIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (periodPaymentsResult.error || cashParentsResult.error) throw new Error('Não foi possível consolidar os pagamentos.');
  const periodPayments = periodPaymentsResult.data ?? [];
  const cashParents = new Map((cashParentsResult.data ?? []).map((item) => [item.id, item]));
  const paidByReceivable = new Map<string, number>();
  periodPayments.forEach((payment) => paidByReceivable.set(payment.receivable_id, (paidByReceivable.get(payment.receivable_id) ?? 0) + payment.amount_cents));

  const billed = sum(receivables, (item) => item.amount_cents);
  const received = sum(cashPayments, (item) => item.amount_cents);
  const pending = sum(receivables, (item) => Math.max(0, item.amount_cents - (paidByReceivable.get(item.id) ?? 0)));
  const expensesIncurred = sum(competenceExpenses, (item) => item.amount_cents);
  const expensesPaid = sum(paidExpenses, (item) => item.amount_cents);

  const dayCount = Number(end.slice(-2));
  const daily = Array.from({ length: dayCount }, (_, index) => ({ label: String(index + 1).padStart(2, '0'), revenue: 0, expense: 0 }));
  if (regime === 'competence') {
    receivables.forEach((item) => { daily[Number(item.service_date.slice(-2)) - 1].revenue += item.amount_cents; });
    competenceExpenses.forEach((item) => { daily[Number(item.competence_date.slice(-2)) - 1].expense += item.amount_cents; });
  } else {
    cashPayments.forEach((item) => { daily[Number(item.paid_at.slice(-2)) - 1].revenue += item.amount_cents; });
    paidExpenses.forEach((item) => { if (item.paid_at) daily[Number(item.paid_at.slice(-2)) - 1].expense += item.amount_cents; });
  }

  const profileNames = new Map((profilesResult.data ?? []).map((item) => [item.id, item.display_name]));
  const professionals = (professionalsResult.data ?? []).map((item) => ({ id: item.id, name: profileNames.get(item.user_id) ?? 'Profissional', revenue: 0, received: 0, expense: 0 }));
  const professionalMap = new Map(professionals.map((item) => [item.id, item]));
  receivables.forEach((item) => { const target = professionalMap.get(item.professional_id); if (target) target.revenue += item.amount_cents; });
  cashPayments.forEach((payment) => { const target = professionalMap.get(cashParents.get(payment.receivable_id)?.professional_id ?? ''); if (target) target.received += payment.amount_cents; });
  const expenseRows = regime === 'cash' ? paidExpenses : competenceExpenses;
  let sharedExpense = 0;
  expenseRows.forEach((item) => { if (item.responsibility === 'shared') sharedExpense += item.amount_cents; else { const target = professionalMap.get(item.professional_id ?? ''); if (target) target.expense += item.amount_cents; } });
  const professionalChart = professionals.map(({ name, revenue, received, expense }) => ({ name, revenue, received, expense }));
  if (sharedExpense) professionalChart.push({ name: 'Clínica', revenue: 0, received: 0, expense: sharedExpense });

  const statusLabels: Record<string, string> = { pending: 'Pendente', partially_paid: 'Parcial', paid: 'Pago', planned: 'Previsto' };
  const transactions = regime === 'competence'
    ? [
        ...receivables.map((item) => ({ id: item.id, type: 'revenue' as const, description: item.description, date: item.service_date, amount: item.amount_cents, status: statusLabels[item.status] ?? item.status, professional: professionalMap.get(item.professional_id)?.name ?? 'Profissional' })),
        ...competenceExpenses.map((item) => ({ id: item.id, type: 'expense' as const, description: item.description, date: item.competence_date, amount: item.amount_cents, status: statusLabels[item.status] ?? item.status, professional: item.responsibility === 'shared' ? 'Clínica' : professionalMap.get(item.professional_id ?? '')?.name ?? 'Profissional' })),
      ]
    : [
        ...cashPayments.map((item) => { const parent = cashParents.get(item.receivable_id); return { id: item.id, type: 'payment' as const, description: parent?.description ?? 'Recebimento', date: item.paid_at, amount: item.amount_cents, status: 'Recebido', professional: professionalMap.get(parent?.professional_id ?? '')?.name ?? 'Profissional' }; }),
        ...paidExpenses.map((item) => ({ id: item.id, type: 'expense' as const, description: item.description, date: item.paid_at ?? item.competence_date, amount: item.amount_cents, status: 'Pago', professional: item.responsibility === 'shared' ? 'Clínica' : professionalMap.get(item.professional_id ?? '')?.name ?? 'Profissional' })),
      ];
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  return <><div className="page-heading procedure-heading finance-title"><div><span className="overline">GESTÃO FINANCEIRA</span><h1>Gastos e ganhos</h1><p className="muted">Acompanhe o que foi faturado, recebido, gasto e efetivamente pago.</p></div><div className="privacy-chip"><Landmark size={18}/><span>Visão consolidada<small>Ester, Izabela e clínica</small></span></div></div><FinancialDashboard month={month} regime={regime} clients={(clientsResult.data ?? []).map((item) => ({ id: item.id, name: item.full_name }))} procedures={(proceduresResult.data ?? []).map((item) => ({ id: item.id, name: item.name }))} data={{ metrics: { billed, received, pending, expensesIncurred, expensesPaid, competenceResult: billed - expensesIncurred, cashResult: received - expensesPaid }, daily, professionals: professionalChart, transactions: transactions.slice(0, 12) }}/></>;
}
