import type { FinancialDashboardViewModel } from './dashboard';

type Transaction = FinancialDashboardViewModel['transactions'][number];

const typeLabels: Record<Transaction['type'], string> = {
  revenue: 'Receita',
  payment: 'Recebimento',
  expense: 'Gasto',
};

function safeCell(value: string) {
  const protectedValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(protectedValue) ? `"${protectedValue.replaceAll('"', '""')}"` : protectedValue;
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export function buildFinancialCsv(transactions: FinancialDashboardViewModel['transactions']) {
  const rows = transactions.map((item) => [
    formatDate(item.date),
    typeLabels[item.type],
    item.description,
    item.professional,
    item.status,
    (item.amount / 100).toFixed(2).replace('.', ','),
  ].map((cell) => safeCell(String(cell))).join(';'));

  return ['Data;Tipo;Descrição;Profissional;Status;Valor (R$)', ...rows].join('\r\n');
}
