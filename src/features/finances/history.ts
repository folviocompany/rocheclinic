import type { FinancialDashboardViewModel } from "./dashboard";

export type Transaction = FinancialDashboardViewModel["transactions"][number];
export type HistoryFilters = {
  search?: string;
  professional?: string;
  status?: string;
  type?: string;
};
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function selectHistory(
  items: Transaction[],
  filters: HistoryFilters,
  requestedPage = 1,
) {
  const search = normalize(filters.search ?? "");
  const filtered = items.filter(
    (item) =>
      (!search || normalize(item.description).includes(search)) &&
      (!filters.professional || item.professional === filters.professional) &&
      (!filters.status || item.status === filters.status) &&
      (!filters.type || item.type === filters.type),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const page = Math.min(
    pages,
    Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1),
  );
  return {
    items: filtered.slice((page - 1) * 12, page * 12),
    total: filtered.length,
    pages,
    page,
  };
}
