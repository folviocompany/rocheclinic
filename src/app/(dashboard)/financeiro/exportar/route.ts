import { endOfMonth, format, isMatch, parseISO } from 'date-fns';
import { buildFinancialDashboard, type FinancialRegime } from '@/features/finances/dashboard';
import { buildFinancialCsv } from '@/features/finances/csv';
import { getFinancialDashboardData } from '@/features/finances/data-access';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month');
  const regime: FinancialRegime = url.searchParams.get('regime') === 'cash' ? 'cash' : 'competence';

  if (!month || !isMatch(month, 'yyyy-MM')) {
    return new Response('Mês inválido.', { status: 400 });
  }

  const start = `${month}-01`;
  const end = format(endOfMonth(parseISO(start)), 'yyyy-MM-dd');
  const payload = await getFinancialDashboardData(start, end);
  const dashboard = buildFinancialDashboard(payload, regime, end);
  const csv = buildFinancialCsv(dashboard.transactions);
  const filename = `financeiro-${month}-${regime === 'cash' ? 'caixa' : 'competencia'}.csv`;

  return new Response(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
