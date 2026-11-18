import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFinancialDashboard } from '../src/features/finances/dashboard.ts';

const payload = {
  receivables: [{ id: 'r1', professional_id: 'p1', description: 'Atendimento', amount_cents: 30000, service_date: '2026-11-15', status: 'partially_paid' }],
  cashPayments: [{ id: 'pay1', receivable_id: 'r1', amount_cents: 10000, paid_at: '2026-11-15' }],
  periodPayments: [{ receivable_id: 'r1', amount_cents: 10000 }],
  cashParents: [{ id: 'r1', professional_id: 'p1', description: 'Atendimento' }],
  expenses: [
    { id: 'e1', description: 'Material', amount_cents: 5000, competence_date: '2026-11-10', paid_at: null, responsibility: 'individual', professional_id: 'p1', status: 'pending' },
    { id: 'e2', description: 'Aluguel', amount_cents: 10000, competence_date: '2026-11-05', paid_at: '2026-11-05', responsibility: 'shared', professional_id: null, status: 'paid' },
  ],
  paidExpenses: [{ id: 'e2', description: 'Aluguel', amount_cents: 10000, competence_date: '2026-11-05', paid_at: '2026-11-05', responsibility: 'shared', professional_id: null, status: 'paid' }],
  professionals: [{ id: 'p1', user_id: 'u1' }],
  profiles: [{ id: 'u1', display_name: 'Ester' }],
  clients: [],
  procedures: [],
  openReceivables: [
    { id: 'r1', description: 'Atendimento', client_name: null, amount_cents: 30000, paid_cents: 10000, balance_cents: 20000, due_date: '2026-11-15', status: 'partially_paid' },
  ],
  openExpenses: [
    { id: 'e1', description: 'Material', category: 'Insumos', amount_cents: 5000, due_date: '2026-11-10', responsibility: 'individual', status: 'pending' },
  ],
  cashReversals: [],
  reversibleEntries: [],
  reopenableEntries: [],
  expenseCategories: [{ id: 'c1', name: 'Insumos', active: true }],
  expenseRecurrences: [],
};

test('calcula faturamento, caixa e saldo parcial sem duplicidade', () => {
  const result = buildFinancialDashboard(payload, 'competence', '2026-11-30');
  assert.deepEqual(result.metrics, {
    billed: 30000,
    received: 10000,
    pending: 20000,
    expensesIncurred: 15000,
    expensesPaid: 10000,
    competenceResult: 15000,
    cashResult: 0,
  });
});

test('separa competência e caixa nas séries e movimentações', () => {
  const competence = buildFinancialDashboard(payload, 'competence', '2026-11-30');
  const cash = buildFinancialDashboard(payload, 'cash', '2026-11-30');

  assert.equal(competence.daily[14].revenue, 30000);
  assert.equal(cash.daily[14].revenue, 10000);
  assert.equal(competence.transactions[0].type, 'revenue');
  assert.equal(cash.transactions[0].type, 'payment');
});

test('atribui receitas à profissional e gastos compartilhados à clínica', () => {
  const result = buildFinancialDashboard(payload, 'competence', '2026-11-30');
  assert.deepEqual(result.professionals, [
    { name: 'Ester', revenue: 30000, received: 10000, expense: 5000 },
    { name: 'Clínica', revenue: 0, received: 0, expense: 10000 },
  ]);
});

test('expõe somente o saldo real das contas abertas para recebimento', () => {
  const result = buildFinancialDashboard(payload, 'competence', '2026-11-30');
  assert.deepEqual(result.openReceivables, payload.openReceivables);
  assert.equal(result.openReceivables[0].balance_cents, 20000);
});

test('expõe as contas abertas que podem ser pagas pela usuária', () => {
  const result = buildFinancialDashboard(payload, 'competence', '2026-11-30');
  assert.deepEqual(result.openExpenses, payload.openExpenses);
});

test('devoluções reais geram movimento oposto no caixa', () => {
  const reversed = buildFinancialDashboard({ ...payload, cashReversals: [{ id: 'rev1', target_type: 'receivable', target_id: 'r1', amount_cents: 10000, effective_date: '2026-11-20', reversal_type: 'refund', description: 'Atendimento', professional_id: 'p1', responsibility: null, expense_professional_id: null }] }, 'cash', '2026-11-30');
  assert.equal(reversed.metrics.received, 0);
  assert.equal(reversed.daily[19].revenue, -10000);
  assert.equal(reversed.transactions[0].type, 'reversal');
});
