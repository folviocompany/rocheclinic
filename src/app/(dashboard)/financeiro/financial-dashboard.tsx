"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  expenseFormSchema,
  formatMoney,
  paymentMethods,
  revenueFormSchema,
  type ExpenseFormValues,
  type RevenueFormValues,
} from "@/features/finances/schema";
import { registerExpense, registerRevenue } from "./actions";
import type { FinancialDashboardViewModel } from "@/features/finances/dashboard";
import { AccountsReceivablePanel } from "./accounts-receivable-panel";
import { AccountsPayablePanel } from "./accounts-payable-panel";
import { FinancialReversalPanel } from "./financial-reversal-panel";
import { ExpenseCategoryManager } from "./expense-category-manager";
import { ExpenseRecurrenceManager } from "./expense-recurrence-manager";
import { DeferredFinancialCharts } from "./deferred-financial-charts";

type Option = { id: string; name: string };
const today = new Date().toISOString().slice(0, 10);
const emptyRevenue: RevenueFormValues = {
  description: "",
  amount: "",
  launchDate: today,
  clientId: "",
  procedureId: "",
  status: "pending",
  paymentMethod: "",
};
const emptyExpense: ExpenseFormValues = {
  description: "",
  category: "",
  amount: "",
  launchDate: today,
  responsibility: "individual",
  status: "pending",
  paymentMethod: "",
  notes: "",
  recurring: false,
};
const methodLabels: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  debit_card: "Cartão de débito",
  credit_card: "Cartão de crédito",
  transfer: "Transferência",
  other: "Outros",
};

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
  const [pending, startTransition] = useTransition();
  const revenueForm = useForm<RevenueFormValues>({
    resolver: zodResolver(revenueFormSchema),
    defaultValues: emptyRevenue,
  });
  const expenseForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: emptyExpense,
  });
  const revenueStatus = revenueForm.watch("status");
  const expenseStatus = expenseForm.watch("status");

  function changeFilters(nextMonth: string, nextRegime: string) {
    router.push(
      `/financeiro?month=${encodeURIComponent(nextMonth)}&regime=${nextRegime}`,
    );
  }
  function openModal(kind: "revenue" | "expense") {
    setNotice(null);
    setModal(kind);
    if (kind === "revenue")
      revenueForm.reset({
        ...emptyRevenue,
        launchDate: `${month}-01`,
      });
    else
      expenseForm.reset({
        ...emptyExpense,
        launchDate: `${month}-01`,
      });
  }
  function submitRevenue(values: RevenueFormValues) {
    startTransition(async () => {
      const result = await registerRevenue(values);
      if (!result.ok) {
        if (result.fieldErrors)
          Object.entries(result.fieldErrors).forEach(([field, message]) =>
            revenueForm.setError(field as keyof RevenueFormValues, { message }),
          );
        setNotice({ kind: "error", text: result.message });
        return;
      }
      setModal(null);
      setNotice({ kind: "success", text: result.message });
    });
  }
  function submitExpense(values: ExpenseFormValues) {
    startTransition(async () => {
      const result = await registerExpense(values);
      if (!result.ok) {
        if (result.fieldErrors)
          Object.entries(result.fieldErrors).forEach(([field, message]) =>
            expenseForm.setError(field as keyof ExpenseFormValues, { message }),
          );
        setNotice({ kind: "error", text: result.message });
        return;
      }
      setModal(null);
      setNotice({ kind: "success", text: result.message });
    });
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
      <div className="finance-filters">
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
          hint={
            regime === "cash" ? "Gastos pagos" : "Gastos lançados"
          }
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
      <ExpenseRecurrenceManager recurrences={data.expenseRecurrences} categories={data.expenseCategories} />
      <DeferredFinancialCharts daily={data.daily} professionals={data.professionals} regime={regime} />
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
        <div className="modal-backdrop" role="presentation">
          <section
            className="procedure-modal finance-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-heading">
              <div>
                <span className="overline">
                  {modal === "revenue"
                    ? "ENTRADA FINANCEIRA"
                    : "SAÍDA FINANCEIRA"}
                </span>
                <h2>
                  {modal === "revenue" ? "Registrar ganho" : "Registrar gasto"}
                </h2>
                <p>
                  {modal === "revenue"
                    ? "Informe a data do lançamento e se o valor já foi recebido."
                    : "Informe a data, a situação e se o gasto se repete mensalmente."}
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setModal(null)}
                disabled={pending}
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            {modal === "revenue" ? (
              <form
                className="procedure-form"
                onSubmit={revenueForm.handleSubmit(submitRevenue)}
                noValidate
              >
                <div className="form-row two">
                  <Field
                    label="Descrição"
                    error={revenueForm.formState.errors.description?.message}
                  >
                    <input
                      {...revenueForm.register("description")}
                      placeholder="Ex.: Atendimento realizado"
                    />
                  </Field>
                  <Field
                    label="Valor total (R$)"
                    error={revenueForm.formState.errors.amount?.message}
                  >
                    <input
                      {...revenueForm.register("amount")}
                      inputMode="decimal"
                      placeholder="250,00"
                    />
                  </Field>
                </div>
                <div className="form-row two">
                  <Field
                    label="Cliente"
                    hint="Opcional"
                    error={revenueForm.formState.errors.clientId?.message}
                  >
                    <select {...revenueForm.register("clientId")}>
                      <option value="">Sem cliente vinculada</option>
                      {clients.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Procedimento"
                    hint="Opcional"
                    error={revenueForm.formState.errors.procedureId?.message}
                  >
                    <select {...revenueForm.register("procedureId")}>
                      <option value="">Sem procedimento vinculado</option>
                      {procedures.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="form-row two">
                  <Field
                    label="Data do lançamento"
                    error={revenueForm.formState.errors.launchDate?.message}
                  >
                    <input type="date" {...revenueForm.register("launchDate")} />
                  </Field>
                  <Field
                    label="Situação"
                    error={revenueForm.formState.errors.status?.message}
                  >
                    <select {...revenueForm.register("status")}>
                      <option value="pending">Pendente</option>
                      <option value="received">Recebido</option>
                    </select>
                  </Field>
                </div>
                {revenueStatus === "received" && (
                  <div className="payment-block">
                    <h3>Recebimento concluído</h3>
                    <p>A data do recebimento será a mesma do lançamento.</p>
                    <Field
                      label="Forma de pagamento"
                      error={
                        revenueForm.formState.errors.paymentMethod?.message
                      }
                    >
                      <select {...revenueForm.register("paymentMethod")}>
                        <option value="">Selecione</option>
                        {paymentMethods.map((method) => (
                          <option value={method} key={method}>
                            {methodLabels[method]}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}
                {notice?.kind === "error" && (
                  <p className="alert error">{notice.text}</p>
                )}
                <ModalActions
                  pending={pending}
                  onCancel={() => setModal(null)}
                  label="Registrar ganho"
                />
              </form>
            ) : (
              <form
                className="procedure-form"
                onSubmit={expenseForm.handleSubmit(submitExpense)}
                noValidate
              >
                <div className="form-row two">
                  <Field
                    label="Descrição"
                    error={expenseForm.formState.errors.description?.message}
                  >
                    <input
                      {...expenseForm.register("description")}
                      placeholder="Ex.: Materiais de atendimento"
                    />
                  </Field>
                  <Field
                    label="Categoria"
                    error={expenseForm.formState.errors.category?.message}
                  >
                    <select {...expenseForm.register("category")}>
                      <option value="">Selecione</option>
                      {data.expenseCategories
                        .filter((category) => category.active)
                        .map((category) => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
                <div className="form-row two">
                  <Field
                    label="Valor (R$)"
                    error={expenseForm.formState.errors.amount?.message}
                  >
                    <input
                      {...expenseForm.register("amount")}
                      inputMode="decimal"
                      placeholder="120,00"
                    />
                  </Field>
                  <Field
                    label="Data do lançamento"
                    error={expenseForm.formState.errors.launchDate?.message}
                  >
                    <input type="date" {...expenseForm.register("launchDate")} />
                  </Field>
                </div>
                <div className="form-row two">
                  <Field
                    label="Responsabilidade"
                    error={expenseForm.formState.errors.responsibility?.message}
                  >
                    <select {...expenseForm.register("responsibility")}>
                      <option value="individual">
                        Minha despesa individual
                      </option>
                      <option value="shared">
                        Despesa compartilhada da clínica
                      </option>
                    </select>
                  </Field>
                  <Field
                    label="Situação"
                    error={expenseForm.formState.errors.status?.message}
                  >
                    <select {...expenseForm.register("status")}>
                      <option value="pending">Pendente</option>
                      <option value="paid">Paga</option>
                    </select>
                  </Field>
                </div>
                {expenseStatus === "paid" && (
                  <div className="payment-block">
                    <p>A data do pagamento será a mesma do lançamento.</p>
                    <Field
                      label="Forma de pagamento"
                      error={
                        expenseForm.formState.errors.paymentMethod?.message
                      }
                    >
                      <select {...expenseForm.register("paymentMethod")}>
                        <option value="">Selecione</option>
                        {paymentMethods.map((method) => (
                          <option value={method} key={method}>
                            {methodLabels[method]}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}
                <label className="check-field compact">
                  <input type="checkbox" {...expenseForm.register("recurring")} />
                  <span>
                    <strong>Repetir mensalmente</strong>
                    <small>O gasto será lançado todo mês até você alterar ou encerrar a recorrência.</small>
                  </span>
                </label>
                <Field
                  label="Observações"
                  hint="Opcional"
                  error={expenseForm.formState.errors.notes?.message}
                >
                  <textarea {...expenseForm.register("notes")} rows={3} />
                </Field>
                {notice?.kind === "error" && (
                  <p className="alert error">{notice.text}</p>
                )}
                <ModalActions
                  pending={pending}
                  onCancel={() => setModal(null)}
                  label="Registrar gasto"
                />
              </form>
            )}
          </section>
        </div>
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
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="form-field">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
      {error && <em>{error}</em>}
    </label>
  );
}
function ModalActions({
  pending,
  onCancel,
  label,
}: {
  pending: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="modal-actions">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={pending}
      >
        Cancelar
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="spin" size={17} /> Salvando…
          </>
        ) : (
          label
        )}
      </Button>
    </div>
  );
}
