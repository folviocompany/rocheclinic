"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  CircleDollarSign,
  Clock3,
  Download,
  LoaderCircle,
  Plus,
  ReceiptText,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/features/finances/schema";
import dynamic from "next/dynamic";
const FinancialEntryModal = dynamic(
  () => import("./financial-entry-modal").then((m) => m.FinancialEntryModal),
  {
    loading: () => (
      <div className="modal-backdrop" role="status">
        <section className="procedure-modal">
          <p className="procedure-form">Carregando formulário…</p>
        </section>
      </div>
    ),
  },
);
import type { FinancialDashboardViewModel } from "@/features/finances/dashboard";
import { AccountsReceivablePanel } from "./accounts-receivable-panel";
import { AccountsPayablePanel } from "./accounts-payable-panel";
import { FinancialReversalPanel } from "./financial-reversal-panel";
import { ExpenseCategoryManager } from "./expense-category-manager";
import { ExpenseRecurrenceManager } from "./expense-recurrence-manager";
import { DeferredFinancialCharts } from "./deferred-financial-charts";

type Option = { id: string; name: string };
export function FinancialDashboard({
  data,
  month,
  regime,
  clients,
  procedures,
}: {
  data: FinancialDashboardViewModel;
  month: string;
  regime: "competence" | "cash";
  clients: Option[];
  procedures: Option[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"revenue" | "expense" | null>(null);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [navigating, startNavigation] = useTransition();
  function changeFilters(nextMonth: string, nextRegime: string) {
    if (!/^\d{4}-\d{2}$/.test(nextMonth)) return;
    startNavigation(() =>
      router.push(
        `/financeiro?month=${encodeURIComponent(nextMonth)}&regime=${nextRegime}`,
        { scroll: false },
      ),
    );
  }
  function openModal(kind: "revenue" | "expense") {
    setNotice(null);
    setModal(kind);
  }
  const mainResult =
    regime === "cash" ? data.metrics.cashResult : data.metrics.competenceResult;
  return (
    <>
      <div className="finance-export">
        <Button asChild variant="outline">
          <a
            href={`/financeiro/exportar?month=${encodeURIComponent(month)}&regime=${regime}`}
          >
            <Download size={17} /> Exportar CSV
          </a>
        </Button>
      </div>
      {navigating && (
        <p role="status">
          <LoaderCircle size={16} className="spin" /> Atualizando período…
        </p>
      )}
      <div className="finance-filters" aria-busy={navigating}>
        <label>
          <CalendarRange size={17} />
          <input
            type="month"
            value={month}
            onChange={(event) => changeFilters(event.target.value, regime)}
            aria-label="Mês de referência"
          />
        </label>
        <div className="regime-toggle">
          <button
            className={regime === "competence" ? "selected" : ""}
            onClick={() => changeFilters(month, "competence")}
          >
            Lançamentos
          </button>
          <button
            className={regime === "cash" ? "selected" : ""}
            onClick={() => changeFilters(month, "cash")}
          >
            Realizados
          </button>
        </div>
        <div className="finance-quick-actions">
          <Button variant="outline" onClick={() => openModal("expense")}>
            <ArrowDownRight size={17} /> Registrar gasto
          </Button>
          <Button onClick={() => openModal("revenue")}>
            <Plus size={17} /> Registrar ganho
          </Button>
        </div>
      </div>
      {notice && (
        <p
          className={`alert ${notice.kind === "error" ? "error" : "success"}`}
          role="status"
        >
          {notice.text}
        </p>
      )}
      <div className="finance-metrics">
        <Metric
          icon={CircleDollarSign}
          label="Ganhos lançados"
          value={data.metrics.billed}
          hint="Atendimentos do período"
          tone="rose"
        />
        <Metric
          icon={WalletCards}
          label="Recebido"
          value={data.metrics.received}
          hint="Entradas efetivas"
          tone="green"
        />
        <Metric
          icon={Clock3}
          label="A receber"
          value={data.metrics.pending}
          hint="Saldo do faturado"
          tone="gold"
        />
        <Metric
          icon={ReceiptText}
          label={regime === "cash" ? "Gastos pagos" : "Gastos incorridos"}
          value={
            regime === "cash"
              ? data.metrics.expensesPaid
              : data.metrics.expensesIncurred
          }
          hint={regime === "cash" ? "Gastos pagos" : "Gastos lançados"}
          tone="red"
        />
        <Metric
          icon={TrendingUp}
          label="Resultado estimado"
          value={mainResult}
          hint={
            regime === "cash"
              ? "Recebido menos pago"
              : "Ganhos menos gastos lançados"
          }
          tone={mainResult >= 0 ? "green" : "red"}
          emphasized
        />
      </div>
      <p className="managerial-note">
        Resultado gerencial estimado. Não representa lucro contábil ou valor
        automaticamente disponível para distribuição.
      </p>
      <AccountsReceivablePanel items={data.openReceivables} />
      <AccountsPayablePanel items={data.openExpenses} />
      <FinancialReversalPanel
        entries={data.reversibleEntries}
        reopenable={data.reopenableEntries}
      />
      <ExpenseCategoryManager categories={data.expenseCategories} />
      <ExpenseRecurrenceManager
        recurrences={data.expenseRecurrences}
        categories={data.expenseCategories}
      />
      <DeferredFinancialCharts
        daily={data.daily}
        professionals={data.professionals}
        regime={regime}
      />
      <section className="transactions-card">
        <div className="chart-heading">
          <div>
            <span className="overline">MOVIMENTAÇÕES</span>
            <h2>Registros do período</h2>
          </div>
          <span>{data.transactions.length} lançamentos</span>
        </div>
        {data.transactions.length ? (
          <div className="transaction-list">
            {data.transactions.map((item) => (
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
            Nenhuma movimentação neste período.
          </div>
        )}
      </section>

      {modal && (
        <FinancialEntryModal
          modal={modal}
          month={month}
          clients={clients}
          procedures={procedures}
          categories={data.expenseCategories}
          onClose={() => setModal(null)}
          onSuccess={(text) => {
            setModal(null);
            setNotice({ kind: "success", text });
          }}
        />
      )}
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  emphasized = false,
}: {
  icon: typeof CircleDollarSign;
  label: string;
  value: number;
  hint: string;
  tone: string;
  emphasized?: boolean;
}) {
  return (
    <article className={`finance-metric ${emphasized ? "emphasized" : ""}`}>
      <span className={`metric-icon ${tone}`}>
        <Icon size={20} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{formatMoney(value)}</strong>
        <p>{hint}</p>
      </div>
    </article>
  );
}
