import { financialPeriod } from "@/features/finances/period";
import { scopeFinancialData } from "@/features/finances/scope";
import {
  buildFinancialDashboard,
  type FinancialRegime,
} from "@/features/finances/dashboard";
import { buildFinancialCsv } from "@/features/finances/csv";
import { getFinancialDashboardData } from "@/features/finances/data-access";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const period = financialPeriod(
    url.searchParams.get("kind") ?? "month",
    url.searchParams.get("period") ?? url.searchParams.get("month") ?? "",
  );
  const scope = url.searchParams.get("scope") ?? "all";
  const regime: FinancialRegime =
    url.searchParams.get("regime") === "cash" ? "cash" : "competence";

  if (!period) {
    return new Response("Período inválido.", { status: 400 });
  }

  const { start, end } = period;
  const payload = await getFinancialDashboardData(start, end);
  if (
    !["all", "clinic"].includes(scope) &&
    !payload.professionals.some((p) => p.id === scope)
  )
    return new Response("Profissional inválida.", { status: 400 });
  const dashboard = buildFinancialDashboard(
    scopeFinancialData(payload, scope),
    regime,
    end,
    period.kind,
  );
  const csv = buildFinancialCsv(dashboard.transactions);
  const filename = `financeiro-${period.value}-${scope}-${regime === "cash" ? "caixa" : "competencia"}.csv`;

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
