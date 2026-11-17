export type FinancialRegime = 'competence' | 'cash';

export type FinancialDashboardPayload = {
  receivables: Array<{ id: string; professional_id: string; description: string; amount_cents: number; service_date: string; status: string }>;
  cashPayments: Array<{ id: string; receivable_id: string; amount_cents: number; paid_at: string }>;
  periodPayments: Array<{ receivable_id: string; amount_cents: number }>;
  cashParents: Array<{ id: string; professional_id: string; description: string }>;
  expenses: ExpenseDashboardRow[];
  paidExpenses: ExpenseDashboardRow[];
  professionals: Array<{ id: string; user_id: string }>;
  profiles: Array<{ id: string; display_name: string }>;
  clients: Array<{ id: string; full_name: string }>;
  procedures: Array<{ id: string; professional_id: string; name: string }>;
  openReceivables: OpenReceivableRow[];
};

export type OpenReceivableRow = {
  id: string;
  professional_id?: string;
  description: string;
  client_name: string | null;
  amount_cents: number;
  paid_cents: number;
  balance_cents: number;
  due_date: string;
  status: string;
};

type ExpenseDashboardRow = {
  id: string;
  description: string;
  amount_cents: number;
  competence_date: string;
  paid_at: string | null;
  responsibility: string;
  professional_id: string | null;
  status: string;
};

export type FinancialDashboardViewModel = {
  metrics: { billed: number; received: number; pending: number; expensesIncurred: number; expensesPaid: number; competenceResult: number; cashResult: number };
  daily: Array<{ label: string; revenue: number; expense: number }>;
  professionals: Array<{ name: string; revenue: number; received: number; expense: number }>;
  transactions: Array<{ id: string; type: 'revenue' | 'payment' | 'expense'; description: string; date: string; amount: number; status: string; professional: string }>;
  openReceivables: OpenReceivableRow[];
};

const sum = <T,>(items: T[], getter: (item: T) => number) => items.reduce((total, item) => total + getter(item), 0);

export function buildFinancialDashboard(
  payload: FinancialDashboardPayload,
  regime: FinancialRegime,
  periodEnd: string,
): FinancialDashboardViewModel {
  const paidByReceivable = new Map<string, number>();
  for (const payment of payload.periodPayments) {
    paidByReceivable.set(payment.receivable_id, (paidByReceivable.get(payment.receivable_id) ?? 0) + payment.amount_cents);
  }

  const billed = sum(payload.receivables, (item) => item.amount_cents);
  const received = sum(payload.cashPayments, (item) => item.amount_cents);
  const pending = sum(payload.receivables, (item) => Math.max(0, item.amount_cents - (paidByReceivable.get(item.id) ?? 0)));
  const expensesIncurred = sum(payload.expenses, (item) => item.amount_cents);
  const expensesPaid = sum(payload.paidExpenses, (item) => item.amount_cents);

  const dayCount = Number(periodEnd.slice(-2));
  const daily = Array.from({ length: dayCount }, (_, index) => ({
    label: String(index + 1).padStart(2, '0'),
    revenue: 0,
    expense: 0,
  }));

  if (regime === 'competence') {
    for (const item of payload.receivables) daily[Number(item.service_date.slice(-2)) - 1].revenue += item.amount_cents;
    for (const item of payload.expenses) daily[Number(item.competence_date.slice(-2)) - 1].expense += item.amount_cents;
  } else {
    for (const item of payload.cashPayments) daily[Number(item.paid_at.slice(-2)) - 1].revenue += item.amount_cents;
    for (const item of payload.paidExpenses) {
      if (item.paid_at) daily[Number(item.paid_at.slice(-2)) - 1].expense += item.amount_cents;
    }
  }

  const profileNames = new Map(payload.profiles.map((item) => [item.id, item.display_name]));
  const professionals = payload.professionals.map((item) => ({
    id: item.id,
    name: profileNames.get(item.user_id) ?? 'Profissional',
    revenue: 0,
    received: 0,
    expense: 0,
  }));
  const professionalMap = new Map(professionals.map((item) => [item.id, item]));
  const cashParents = new Map(payload.cashParents.map((item) => [item.id, item]));

  for (const item of payload.receivables) {
    const professional = professionalMap.get(item.professional_id);
    if (professional) professional.revenue += item.amount_cents;
  }
  for (const payment of payload.cashPayments) {
    const professional = professionalMap.get(cashParents.get(payment.receivable_id)?.professional_id ?? '');
    if (professional) professional.received += payment.amount_cents;
  }

  let sharedExpense = 0;
  const expenseRows = regime === 'cash' ? payload.paidExpenses : payload.expenses;
  for (const item of expenseRows) {
    if (item.responsibility === 'shared') sharedExpense += item.amount_cents;
    else {
      const professional = professionalMap.get(item.professional_id ?? '');
      if (professional) professional.expense += item.amount_cents;
    }
  }

  const professionalChart = professionals.map(({ name, revenue, received, expense }) => ({ name, revenue, received, expense }));
  if (sharedExpense) professionalChart.push({ name: 'Clínica', revenue: 0, received: 0, expense: sharedExpense });

  const statusLabels: Record<string, string> = { pending: 'Pendente', partially_paid: 'Parcial', paid: 'Pago', planned: 'Previsto' };
  const transactions = regime === 'competence'
    ? [
        ...payload.receivables.map((item) => ({ id: item.id, type: 'revenue' as const, description: item.description, date: item.service_date, amount: item.amount_cents, status: statusLabels[item.status] ?? item.status, professional: professionalMap.get(item.professional_id)?.name ?? 'Profissional' })),
        ...payload.expenses.map((item) => ({ id: item.id, type: 'expense' as const, description: item.description, date: item.competence_date, amount: item.amount_cents, status: statusLabels[item.status] ?? item.status, professional: item.responsibility === 'shared' ? 'Clínica' : professionalMap.get(item.professional_id ?? '')?.name ?? 'Profissional' })),
      ]
    : [
        ...payload.cashPayments.map((item) => {
          const parent = cashParents.get(item.receivable_id);
          return { id: item.id, type: 'payment' as const, description: parent?.description ?? 'Recebimento', date: item.paid_at, amount: item.amount_cents, status: 'Recebido', professional: professionalMap.get(parent?.professional_id ?? '')?.name ?? 'Profissional' };
        }),
        ...payload.paidExpenses.map((item) => ({ id: item.id, type: 'expense' as const, description: item.description, date: item.paid_at ?? item.competence_date, amount: item.amount_cents, status: 'Pago', professional: item.responsibility === 'shared' ? 'Clínica' : professionalMap.get(item.professional_id ?? '')?.name ?? 'Profissional' })),
      ];
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  return {
    metrics: { billed, received, pending, expensesIncurred, expensesPaid, competenceResult: billed - expensesIncurred, cashResult: received - expensesPaid },
    daily,
    professionals: professionalChart,
    transactions,
    openReceivables: payload.openReceivables,
  };
}
