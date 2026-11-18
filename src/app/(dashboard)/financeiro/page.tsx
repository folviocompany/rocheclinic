import { financialPeriod, currentMonth } from "@/features/finances/period";
import { scopeFinancialData } from "@/features/finances/scope";
import { Landmark } from "lucide-react";
import {
  buildFinancialDashboard,
  type FinancialRegime,
} from "@/features/finances/dashboard";
import { getFinancialDashboardData } from "@/features/finances/data-access";
import { FinancialDashboard } from "./financial-dashboard";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    regime?: string;
    kind?: string;
    period?: string;
    scope?: string;
  }>;
}) {
  const params = await searchParams;
  const period =
    financialPeriod(
      params.kind ?? "month",
      params.period ?? params.month ?? currentMonth(),
    ) ?? financialPeriod("month", currentMonth())!;
  const regime: FinancialRegime =
    params.regime === "cash" ? "cash" : "competence";
  const payload = await getFinancialDashboardData(period.start, period.end);
  const options = payload.professionals.map((p) => ({
    id: p.id,
    name:
      payload.profiles.find((profile) => profile.id === p.user_id)
        ?.display_name ?? "Profissional",
  }));
  const scope =
    params.scope === "clinic" || options.some((p) => p.id === params.scope)
      ? params.scope!
      : "all";
  const data = buildFinancialDashboard(
    scopeFinancialData(payload, scope),
    regime,
    period.end,
    period.kind,
  );

  return (
    <>
      <div className="page-heading procedure-heading finance-title">
        <div>
          <span className="overline">GESTÃO FINANCEIRA</span>
          <h1>Gastos e ganhos</h1>
          <p className="muted">
            Acompanhe o que foi faturado, recebido, gasto e efetivamente pago.
          </p>
        </div>
        <div className="privacy-chip">
          <Landmark size={18} />
          <span>
            Visão consolidada<small>Ester, Izabela e clínica</small>
          </span>
        </div>
      </div>
      <FinancialDashboard
        month={period.start.slice(0, 7)}
        period={period}
        scope={scope}
        professionalOptions={options}
        regime={regime}
        clients={payload.clients.map((item) => ({
          id: item.id,
          name: item.full_name,
        }))}
        procedures={payload.procedures.map((item) => ({
          id: item.id,
          name: item.name,
        }))}
        data={data}
      />
    </>
  );
}
