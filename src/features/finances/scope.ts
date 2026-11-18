import type { FinancialDashboardPayload } from "./dashboard";
export function scopeFinancialData(
  data: FinancialDashboardPayload,
  scope: string,
): FinancialDashboardPayload {
  if (!scope || scope === "all") return data;
  const clinic = scope === "clinic";
  const owns = (id: string | null) => !clinic && id === scope;
  const expense = (row: {
    responsibility: string;
    professional_id: string | null;
  }) =>
    clinic
      ? row.responsibility === "shared"
      : row.responsibility === "individual" && owns(row.professional_id);
  const parents = new Set(
    data.cashParents
      .filter((row) => owns(row.professional_id))
      .map((row) => row.id),
  );
  const receivables = data.receivables.filter((row) =>
    owns(row.professional_id),
  );
  const ids = new Set(receivables.map((row) => row.id));
  return {
    ...data,
    receivables,
    periodPayments: data.periodPayments.filter((row) =>
      ids.has(row.receivable_id),
    ),
    cashParents: data.cashParents.filter((row) => owns(row.professional_id)),
    cashPayments: data.cashPayments.filter((row) =>
      parents.has(row.receivable_id),
    ),
    expenses: data.expenses.filter(expense),
    paidExpenses: data.paidExpenses.filter(expense),
    professionals: data.professionals.filter((row) => owns(row.id)),
    cashReversals: data.cashReversals.filter((row) =>
      row.target_type === "receivable"
        ? owns(row.professional_id)
        : expense({
            responsibility: row.responsibility ?? "",
            professional_id: row.expense_professional_id,
          }),
    ),
  };
}
