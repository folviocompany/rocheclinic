"use client";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/features/finances/schema";
import {
  selectHistory,
  type HistoryFilters,
  type Transaction,
} from "@/features/finances/history";

const typeLabels = {
  revenue: "Ganho lançado",
  payment: "Recebimento",
  expense: "Gasto",
  reversal: "Devolução",
};
export function FinancialHistory({ items }: { items: Transaction[] }) {
  const [filters, setFilters] = useState<HistoryFilters>({});
  const [page, setPage] = useState(1);
  const result = useMemo(
    () => selectHistory(items, filters, page),
    [items, filters, page],
  );
  const professionals = [
    ...new Set(items.map((item) => item.professional)),
  ].sort();
  const statuses = [...new Set(items.map((item) => item.status))].sort();
  const types = [...new Set(items.map((item) => item.type))];
  function change(field: keyof HistoryFilters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  }
  return (
    <section className="transactions-card">
      <div className="chart-heading">
        <div>
          <span className="overline">MOVIMENTAÇÕES</span>
          <h2>Registros do período</h2>
        </div>
        <span>
          {result.total} de {items.length} registros
        </span>
      </div>
      <p className="muted small">
        Filtros apenas desta lista. Indicadores e CSV consideram o mês inteiro.
      </p>
      <div className="history-filters">
        <label>
          Buscar descrição
          <input
            type="search"
            value={filters.search ?? ""}
            onChange={(event) => change("search", event.target.value)}
            placeholder="Ex.: material"
          />
        </label>
        <label>
          Profissional
          <select
            value={filters.professional ?? ""}
            onChange={(event) => change("professional", event.target.value)}
          >
            <option value="">Todas e clínica</option>
            {professionals.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo
          <select
            value={filters.type ?? ""}
            onChange={(event) => change("type", event.target.value)}
          >
            <option value="">Todos</option>
            {types.map((value) => (
              <option key={value} value={value}>
                {typeLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Situação
          <select
            value={filters.status ?? ""}
            onChange={(event) => change("status", event.target.value)}
          >
            <option value="">Todas</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFilters({});
            setPage(1);
          }}
        >
          Limpar filtros
        </Button>
      </div>
      <p role="status" className="muted small">
        {result.total} registros encontrados
      </p>
      {result.total ? (
        <div className="transaction-list">
          {result.items.map((item) => (
            <div className="transaction-row" key={`${item.type}-${item.id}`}>
              <span
                className={`transaction-icon ${item.type === "expense" ? "out" : ""}`}
              >
                {item.type === "expense" ? (
                  <ArrowDownRight size={17} />
                ) : (
                  <ArrowUpRight size={17} />
                )}
              </span>
              <div>
                <strong>{item.description}</strong>
                <small>
                  {item.professional} ·{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    timeZone: "UTC",
                  }).format(new Date(`${item.date}T00:00:00Z`))}
                </small>
              </div>
              <span className="transaction-status">{item.status}</span>
              <b className={item.type === "expense" ? "negative" : ""}>
                {item.type === "reversal"
                  ? "↩ "
                  : item.type === "expense"
                    ? "- "
                    : "+ "}
                {formatMoney(
                  item.type === "reversal"
                    ? Math.abs(item.amount)
                    : item.amount,
                )}
              </b>
            </div>
          ))}
        </div>
      ) : (
        <div className="transactions-empty">
          Nenhuma movimentação encontrada. Tente limpar os filtros ou mudar o
          mês.
        </div>
      )}
      <nav className="history-pagination" aria-label="Páginas do histórico">
        <Button
          type="button"
          variant="outline"
          disabled={result.page === 1}
          onClick={() => setPage(result.page - 1)}
        >
          Anterior
        </Button>
        <span>
          Página {result.page} de {result.pages}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={result.page === result.pages}
          onClick={() => setPage(result.page + 1)}
        >
          Próxima
        </Button>
      </nav>
    </section>
  );
}
