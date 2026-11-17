import { endOfMonth, format, isMatch, parseISO } from 'date-fns';
import { Landmark } from 'lucide-react';
import { buildFinancialDashboard, type FinancialRegime } from '@/features/finances/dashboard';
import { getFinancialDashboardData } from '@/features/finances/data-access';
import { FinancialDashboard } from './financial-dashboard';

function currentManausMonth() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Manaus',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; regime?: string }>;
}) {
  const params = await searchParams;
  const month = params.month && isMatch(params.month, 'yyyy-MM') ? params.month : currentManausMonth();
  const regime: FinancialRegime = params.regime === 'cash' ? 'cash' : 'competence';
  const start = `${month}-01`;
  const end = format(endOfMonth(parseISO(start)), 'yyyy-MM-dd');
  const payload = await getFinancialDashboardData(start, end);
  const data = buildFinancialDashboard(payload, regime, end);

  return (
    <>
      <div className="page-heading procedure-heading finance-title">
        <div>
          <span className="overline">GESTÃO FINANCEIRA</span>
          <h1>Gastos e ganhos</h1>
          <p className="muted">Acompanhe o que foi faturado, recebido, gasto e efetivamente pago.</p>
        </div>
        <div className="privacy-chip">
          <Landmark size={18} />
          <span>Visão consolidada<small>Ester, Izabela e clínica</small></span>
        </div>
      </div>
      <FinancialDashboard
        month={month}
        regime={regime}
        clients={payload.clients.map((item) => ({ id: item.id, name: item.full_name }))}
        procedures={payload.procedures.map((item) => ({ id: item.id, name: item.name }))}
        data={{ ...data, transactions: data.transactions.slice(0, 12) }}
      />
    </>
  );
}
