export type PeriodKind = "day" | "month" | "year";
export type FinancialPeriod = {
  kind: PeriodKind;
  value: string;
  start: string;
  end: string;
};
export function financialPeriod(
  kind: string,
  value: string,
): FinancialPeriod | null {
  if (!["day", "month", "year"].includes(kind)) return null;
  const pattern =
    kind === "day"
      ? /^\d{4}-\d{2}-\d{2}$/
      : kind === "month"
        ? /^\d{4}-\d{2}$/
        : /^\d{4}$/;
  if (
    !pattern.test(value) ||
    Number(value.slice(0, 4)) < 2000 ||
    Number(value.slice(0, 4)) > 2100
  )
    return null;
  const start =
    kind === "year"
      ? `${value}-01-01`
      : kind === "month"
        ? `${value}-01`
        : value;
  const date = new Date(`${start}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== start
  )
    return null;
  const end =
    kind === "year"
      ? `${value}-12-31`
      : kind === "day"
        ? start
        : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
            .toISOString()
            .slice(0, 10);
  return { kind: kind as PeriodKind, value, start, end };
}
export function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}
