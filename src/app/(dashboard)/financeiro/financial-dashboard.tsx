"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
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

import { FinancialHistory } from "./financial-history";
import {
  financialPeriod,
  machinePeriodValue,
  type FinancialPeriod,
} from "@/features/finances/period";

type Option = { id: string; name: string };
export function FinancialDashboard({
  data,
  month,
  regime,
  clients,
  procedures,
  period,
  scope,
  professionalOptions,
}: {
  data: FinancialDashboardViewModel;
  month: string;
  regime: "competence" | "cash";
  clients: Option[];
  procedures: Option[];
  period: FinancialPeriod;
  scope: string;
  professionalOptions: Option[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"revenue" | "expense" | null>(null);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [navigating, startNavigation] = useTransition();
  const query = (
    value: string,
    regimeValue: string,
    kind = period.kind,
    selectedScope = scope,
  ) =>
    new URLSearchParams({
      period: value,
      kind,
      regime: regimeValue,
      scope: selectedScope,
    }).toString();
  function changeFilters(
    value: string,
    nextRegime: string,
    kind = period.kind,
    selectedScope = scope,
  ) {
    if (!financialPeriod(kind, value)) return;
    startNavigation(() =>
      router.push(
        `/financeiro?${query(value, nextRegime, kind, selectedScope)}`,
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
      {navigating && (
        <p role="status" className="finance-updating">
          <LoaderCircle size={16} className="spin" /> Atualizando período…
        </p>
      )}
      <section className="finance-controls" aria-busy={navigating}>
        <div className="finance-control-grid">
          <div className="finance-control-group">
            <span className="finance-control-label">Consultar por</span>
            <div
              className="period-toggle"
              role="group"
              aria-label="Período da consulta"
            >
              {(["day", "month", "year"] as const).map((kind) => (
                <button
                  type="button"
                  key={kind}
                  className={period.kind === kind ? "selected" : ""}
                  aria-pressed={period.kind === kind}
                  onClick={() =>
                    changeFilters(machinePeriodValue(kind), regime, kind)
                  }
                >
                  {kind === "day" ? "Dia" : kind === "month" ? "Mês" : "Ano"}
                </button>
              ))}
            </div>
          </div>
          <label className="finance-control-field">
            <span className="finance-control-label">Data de referência</span>
            <span className="finance-input-shell">
              <CalendarRange size={17} />
              <input
                type={
                  period.kind === "day"
                    ? "date"
                    : period.kind === "year"
                      ? "number"
                      : "month"
                }
                min={period.kind === "year" ? 2000 : undefined}
                max={period.kind === "year" ? 2100 : undefined}
                value={period.value}
                onChange={(event) => changeFilters(event.target.value, regime)}
                aria-label="Data de referência"
              />
            </span>
          </label>
          <label className="finance-control-field finance-scope-field">
            <span className="finance-control-label">Separar resultados</span>
            <select
              value={scope}
              onChange={(event) =>
                changeFilters(
                  period.value,
                  regime,
                  period.kind,
                  event.target.value,
                )
              }
            >
              <option value="all">Visão consolidada</option>
              <option value="clinic">Clínica · gastos compartilhados</option>
              {professionalOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="finance-control-footer">
          <div className="finance-control-group">
            <span className="finance-control-label">Mostrar valores</span>
            <div className="regime-toggle">
              <button
                type="button"
                className={regime === "competence" ? "selected" : ""}
                onClick={() => changeFilters(period.value, "competence")}
              >
                Lançamentos
              </button>
              <button
                type="button"
                className={regime === "cash" ? "selected" : ""}
                onClick={() => changeFilters(period.value, "cash")}
              >
                Realizados
              </button>
            </div>
          </div>
          <div className="finance-quick-actions">
            <Button asChild variant="outline">
              <a href={`/financeiro/exportar?${query(period.value, regime)}`}>
                <Download size={17} /> Exportar CSV
              </a>
            </Button>
            <Button variant="outline" onClick={() => openModal("expense")}>
              <ArrowDownRight size={17} /> Registrar gasto
            </Button>
            <Button onClick={() => openModal("revenue")}>
              <Plus size={17} /> Registrar ganho
            </Button>
          </div>
        </div>
      </section>
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
      <p className="muted small">
        Gastos compartilhados permanecem na Clínica, sem rateio. As contas e
        ações abaixo pertencem ao seu acesso e incluem pendências de outros
        períodos.
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
      <FinancialHistory
        key={`${period.kind}-${period.value}-${scope}-${regime}`}
        items={data.transactions}
      />

      {modal && (
        <FinancialEntryModal
          modal={modal}
          month={month}
          launchDate={period.start}
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
