import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ester = '10000000-0000-0000-0000-000000000001';
const izabela = '10000000-0000-0000-0000-000000000002';
const outsider = '10000000-0000-0000-0000-000000000003';
const p1 = '20000000-0000-0000-0000-000000000001';
const p2 = '20000000-0000-0000-0000-000000000002';
async function asUser(id, query, params = []) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  try { return await db.query(query, params); }
  finally { await db.exec('reset role'); await db.exec("reset request.jwt.claim.sub"); }
}
before(async () => {
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202611110001_foundation.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611140001_clients.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611150001_financial_foundation.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611160001_financial_dashboard_rpc.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611160002_accounts_receivable.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611170001_accounts_payable.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611170002_financial_cancellations.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611170003_financial_reversals.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611170004_expense_categories.sql', import.meta.url), 'utf8'));
  await db.query('insert into auth.users (id) values ($1), ($2), ($3)', [ester, izabela, outsider]);
  await db.query("insert into profiles (id, display_name) values ($1, 'Profissional A'), ($2, 'Profissional B')", [ester, izabela]);
  await db.query("insert into professionals (id, user_id, specialty) values ($1, $2, 'Área A'), ($3, $4, 'Área B')", [p1, ester, p2, izabela]);
  await asUser(ester, "insert into procedures (professional_id, name, category, price_cents, duration_minutes) values ($1, 'Serviço A', 'A', 15000, 60)", [p1]);
  await asUser(izabela, "insert into procedures (professional_id, name, category, price_cents, duration_minutes) values ($1, 'Serviço B', 'B', 20000, 45)", [p2]);
});
after(async () => { await db.close(); });
test('cada profissional vê somente seu catálogo', async () => {
  assert.deepEqual((await asUser(ester, 'select name from procedures')).rows, [{ name: 'Serviço A' }]);
  assert.deepEqual((await asUser(izabela, 'select name from procedures')).rows, [{ name: 'Serviço B' }]);
});
test('não permite cadastrar ou alterar procedimento de outra profissional', async () => {
  await assert.rejects(asUser(ester, "insert into procedures (professional_id, name, category, duration_minutes) values ($1, 'Invasão', 'A', 60)", [p2]), /row-level security/);
  assert.equal((await asUser(ester, "update procedures set price_cents = 1 where professional_id = $1 returning id", [p2])).rows.length, 0);
  await assert.rejects(asUser(ester, 'update procedures set professional_id = $1', [p2]), /permission denied/);
});
test('não permite elevar permissões ou apagar histórico', async () => {
  await assert.rejects(asUser(ester, 'update profiles set active = true'), /permission denied/);
  await assert.rejects(asUser(ester, 'delete from procedures'), /permission denied/);
  await assert.rejects(asUser(ester, 'delete from audit_logs'), /permission denied/);
});
test('conta Auth sem vínculo administrativo não acessa dados', async () => {
  for (const table of ['profiles', 'professionals', 'procedures', 'clients', 'rooms', 'business_settings', 'audit_logs']) {
    assert.equal((await asUser(outsider, `select * from ${table}`)).rows.length, 0);
  }
});
test('usuário anônimo não acessa tabelas', async () => {
  await db.exec('set role anon');
  try { await assert.rejects(db.query('select * from procedures'), /permission denied/); }
  finally { await db.exec('reset role'); }
});
test('valida dinheiro, duração e duplicidade no banco', async () => {
  await assert.rejects(asUser(ester, 'update procedures set price_cents = -1'), /check constraint/);
  await assert.rejects(asUser(ester, 'update procedures set duration_minutes = 0'), /check constraint/);
  await assert.rejects(asUser(ester, "insert into procedures (professional_id, name, category, duration_minutes) values ($1, ' serviço a ', 'A', 60)", [p1]), /unique constraint/);
});
test('alteração própria funciona e registra auditoria sem dados pessoais', async () => {
  await asUser(ester, 'update procedures set price_cents = 17000');
  assert.equal(Number((await asUser(ester, 'select price_cents from procedures')).rows[0].price_cents), 17000);
  const logs = (await asUser(ester, 'select * from audit_logs')).rows;
  assert.ok(logs.some(log => log.action === 'UPDATE' && log.table_name === 'procedures'));
  assert.ok(logs.every(log => log.actor_id === ester && !('payload' in log)));
});
test('desativação revoga leitura e escrita mesmo com sessão existente', async () => {
  await db.query('update profiles set active = false where id = $1', [ester]);
  try {
    assert.equal((await asUser(ester, 'select * from procedures')).rows.length, 0);
    await assert.rejects(asUser(ester, "insert into procedures (professional_id, name, category, duration_minutes) values ($1, 'Novo', 'A', 60)", [p1]), /row-level security/);
  } finally { await db.query('update profiles set active = true where id = $1', [ester]); }
});

test('cadastro de cliente é compartilhado entre as profissionais', async () => {
  await asUser(ester, "insert into clients (full_name, phone_digits, whatsapp_allowed) values ('Cliente Compartilhada', '92999999999', true)");
  const visibleToIzabela = await asUser(izabela, "select full_name, whatsapp_allowed from clients where phone_digits = '92999999999'");
  assert.deepEqual(visibleToIzabela.rows, [{ full_name: 'Cliente Compartilhada', whatsapp_allowed: true }]);
  await asUser(izabela, "update clients set notes = 'Preferência administrativa' where phone_digits = '92999999999'");
  assert.equal((await asUser(ester, "select notes from clients where phone_digits = '92999999999'")).rows[0].notes, 'Preferência administrativa');
});

test('impede duplicidade exata e preserva autoria no banco', async () => {
  await assert.rejects(asUser(izabela, "insert into clients (full_name, phone_digits) values (' cliente compartilhada ', '92999999999')"), /unique constraint/);
  const client = (await asUser(ester, "select created_by, updated_by from clients where phone_digits = '92999999999'")).rows[0];
  assert.equal(client.created_by, ester);
  assert.equal(client.updated_by, izabela);
});

test('cliente não pode ser apagada pela aplicação', async () => {
  await assert.rejects(asUser(ester, "delete from clients where phone_digits = '92999999999'"), /permission denied/);
});

test('receita com pagamento parcial não duplica faturamento', async () => {
  const result = await asUser(ester, "select register_receivable('Atendimento teste', 30000, '2026-11-15', '2026-11-15', null, null, 10000, 'pix', '2026-11-15') as id");
  const id = result.rows[0].id;
  const receivable = (await asUser(ester, 'select amount_cents, status from receivables where id = $1', [id])).rows[0];
  assert.equal(Number(receivable.amount_cents), 30000);
  assert.equal(receivable.status, 'partially_paid');
  assert.equal(Number((await asUser(ester, 'select sum(amount_cents) as paid from payments where receivable_id = $1', [id])).rows[0].paid), 10000);
});

test('impede pagamento acima do saldo e pagamento em receita alheia', async () => {
  const receivableId = (await asUser(ester, "select id from receivables where description = 'Atendimento teste'")).rows[0].id;
  await assert.rejects(asUser(ester, "insert into payments (receivable_id, amount_cents, paid_at, payment_method) values ($1, 25000, '2026-11-15', 'pix')", [receivableId]), /excede o saldo/);
  await assert.rejects(asUser(izabela, "insert into payments (receivable_id, amount_cents, paid_at, payment_method) values ($1, 1000, '2026-11-15', 'pix')", [receivableId]), /row-level security|não autorizado/);
});

test('registra recebimentos parciais e totais pela função transacional', async () => {
  const created = await asUser(ester, "select register_receivable('Receita para quitação', 20000, '2026-11-16', '2026-11-20', null, null, 0, null, null) as id");
  const receivableId = created.rows[0].id;

  await asUser(ester, "select register_payment($1, 7500, '2026-11-16', 'pix', 'Primeira parcela')", [receivableId]);
  assert.equal((await asUser(ester, 'select status from receivables where id = $1', [receivableId])).rows[0].status, 'partially_paid');

  await asUser(ester, "select register_payment($1, 12500, '2026-11-17', 'transfer', null)", [receivableId]);
  assert.equal((await asUser(ester, 'select status from receivables where id = $1', [receivableId])).rows[0].status, 'paid');
  await assert.rejects(asUser(ester, "select register_payment($1, 1, '2026-11-17', 'pix', null)", [receivableId]), /excede o saldo/);
});

test('função de recebimento não permite quitar receita de outra profissional', async () => {
  const receivableId = (await asUser(ester, "select id from receivables where description = 'Atendimento teste'")).rows[0].id;
  await assert.rejects(asUser(izabela, "select register_payment($1, 1000, '2026-11-16', 'pix', null)", [receivableId]), /não autorizado|row-level security/);
});

test('despesas individuais e compartilhadas respeitam responsabilidade', async () => {
  await asUser(ester, "insert into expenses (description, category, amount_cents, competence_date, due_date, responsibility, professional_id, status) values ('Material', 'Insumos', 5000, '2026-11-01', '2026-11-10', 'individual', $1, 'pending')", [p1]);
  await asUser(izabela, "insert into expenses (description, category, amount_cents, competence_date, due_date, paid_at, responsibility, professional_id, payment_method, status) values ('Aluguel', 'Estrutura', 100000, '2026-11-01', '2026-11-05', '2026-11-05', 'shared', null, 'pix', 'paid')");
  assert.equal((await asUser(ester, 'select * from expenses')).rows.length, 2);
  await assert.rejects(asUser(ester, "insert into expenses (description, category, amount_cents, competence_date, due_date, responsibility, professional_id, status) values ('Invasão', 'Teste', 100, '2026-11-01', '2026-11-01', 'individual', $1, 'pending')", [p2]), /row-level security/);
});

test('categorias de gastos são compartilhadas, únicas e preservam histórico', async () => {
  const created = await asUser(ester, "insert into expense_categories (name) values ('Marketing') returning id");
  const categoryId = created.rows[0].id;
  assert.equal((await asUser(izabela, 'select name from expense_categories where id=$1', [categoryId])).rows[0].name, 'Marketing');
  await asUser(ester, "insert into expenses (description, category, category_id, amount_cents, competence_date, due_date, responsibility, professional_id, status) values ('Anúncios', 'nome ignorado', $1, 9000, '2026-11-01', '2026-11-10', 'individual', $2, 'pending')", [categoryId, p1]);
  assert.equal((await asUser(ester, "select category from expenses where description='Anúncios'")).rows[0].category, 'Marketing');
  await assert.rejects(asUser(izabela, "insert into expense_categories (name) values (' marketing ')") , /unique constraint/);
  await asUser(ester, 'update expense_categories set active=false where id=$1', [categoryId]);
  assert.equal((await asUser(ester, 'select active from expense_categories where id=$1', [categoryId])).rows[0].active, false);
  await assert.rejects(asUser(ester, "insert into expenses (description, category, category_id, amount_cents, competence_date, due_date, responsibility, professional_id, status) values ('Novo anúncio', 'Marketing', $1, 1000, '2026-11-01', '2026-11-10', 'individual', $2, 'pending')", [categoryId, p1]), /inactive/);
  assert.equal((await asUser(ester, "select category from expenses where description='Anúncios'")).rows[0].category, 'Marketing');
});

test('quita uma conta a pagar por função transacional e registra a saída de caixa', async () => {
  const created = await asUser(ester, "insert into expenses (description, category, amount_cents, competence_date, due_date, responsibility, professional_id, status) values ('Fornecedor', 'Insumos', 12500, '2026-11-01', '2026-11-20', 'individual', $1, 'pending') returning id", [p1]);
  const expenseId = created.rows[0].id;

  await asUser(ester, "select settle_expense($1, '2026-11-17', 'transfer')", [expenseId]);
  const settled = (await asUser(ester, 'select status, paid_at, payment_method from expenses where id = $1', [expenseId])).rows[0];
  assert.equal(settled.status, 'paid');
  assert.equal(settled.paid_at.toISOString().slice(0, 10), '2026-11-17');
  assert.equal(settled.payment_method, 'transfer');
  await assert.rejects(asUser(ester, "select settle_expense($1, '2026-11-18', 'pix')", [expenseId]), /já foi pago|não está em aberto/);
});

test('não permite quitar a conta a pagar criada por outra usuária', async () => {
  const created = await asUser(ester, "insert into expenses (description, category, amount_cents, competence_date, due_date, responsibility, professional_id, status) values ('Despesa privada', 'Insumos', 8000, '2026-11-01', '2026-11-25', 'individual', $1, 'pending') returning id", [p1]);
  const expenseId = created.rows[0].id;

  await assert.rejects(asUser(izabela, "select settle_expense($1, '2026-11-17', 'pix')", [expenseId]), /não autorizada|row-level security/);
  assert.equal((await asUser(ester, 'select status from expenses where id = $1', [expenseId])).rows[0].status, 'pending');
});

test('cancela receita sem recebimento e preserva justificativa e autoria', async () => {
  const created = await asUser(ester, "select register_receivable('Receita duplicada', 9000, '2026-11-17', '2026-11-25', null, null, 0, null, null) as id");
  const id = created.rows[0].id;
  await asUser(ester, "select cancel_receivable($1, 'Lançamento duplicado')", [id]);
  const row = (await asUser(ester, 'select status, cancellation_reason, cancelled_by, cancelled_at from receivables where id = $1', [id])).rows[0];
  assert.equal(row.status, 'cancelled');
  assert.equal(row.cancellation_reason, 'Lançamento duplicado');
  assert.equal(row.cancelled_by, ester);
  assert.ok(row.cancelled_at);
});

test('não cancela receita com recebimento nem receita de outra profissional', async () => {
  const paidId = (await asUser(ester, "select id from receivables where description = 'Atendimento teste'")).rows[0].id;
  await assert.rejects(asUser(ester, "select cancel_receivable($1, 'Cancelamento indevido')", [paidId]), /recebimento|movimentação de caixa/);
  const openId = (await asUser(ester, "select register_receivable('Receita protegida', 7000, '2026-11-17', '2026-11-25', null, null, 0, null, null) as id")).rows[0].id;
  await assert.rejects(asUser(izabela, "select cancel_receivable($1, 'Tentativa alheia')", [openId]), /não autorizado/);
});

test('cancela gasto aberto, mas não gasto pago ou criado por outra usuária', async () => {
  const openId = (await asUser(ester, "insert into expenses (description, category, amount_cents, competence_date, due_date, responsibility, professional_id, status) values ('Compra duplicada', 'Insumos', 6000, '2026-11-01', '2026-11-25', 'individual', $1, 'pending') returning id", [p1])).rows[0].id;
  await assert.rejects(asUser(izabela, "select cancel_expense($1, 'Tentativa alheia')", [openId]), /não autorizado/);
  await asUser(ester, "select cancel_expense($1, 'Compra lançada duas vezes')", [openId]);
  const cancelled = (await asUser(ester, 'select status, cancellation_reason from expenses where id = $1', [openId])).rows[0];
  assert.deepEqual(cancelled, { status: 'cancelled', cancellation_reason: 'Compra lançada duas vezes' });

  const paidId = (await asUser(ester, "select id from expenses where description = 'Fornecedor'")).rows[0].id;
  await assert.rejects(asUser(ester, "select cancel_expense($1, 'Pagamento já realizado')", [paidId]), /pago|movimentação de caixa/);
});

test('correção de recebimento reabre o saldo sem apagar pagamentos', async () => {
  const id = (await asUser(ester, "select register_receivable('Correção recebível', 10000, '2026-11-17', '2026-11-20', null, null, 10000, 'pix', '2026-11-17') as id")).rows[0].id;
  await asUser(ester, "select reverse_receivable($1, 'correction', '2026-11-17', 'Pagamento lançado por engano')", [id]);
  assert.equal((await asUser(ester, 'select status from receivables where id = $1', [id])).rows[0].status, 'pending');
  assert.equal((await asUser(ester, 'select count(*)::int as total from payments where receivable_id = $1', [id])).rows[0].total, 1);
});

test('devolução real encerra o recebível e registra movimento oposto', async () => {
  const id = (await asUser(ester, "select register_receivable('Devolução recebível', 12000, '2026-11-17', '2026-11-20', null, null, 5000, 'pix', '2026-11-17') as id")).rows[0].id;
  await asUser(ester, "select reverse_receivable($1, 'refund', '2026-11-18', 'Cliente desistiu do serviço')", [id]);
  assert.equal((await asUser(ester, 'select status from receivables where id = $1', [id])).rows[0].status, 'cancelled');
  const reversal = (await asUser(ester, 'select reversal_type, amount_cents from financial_reversals where target_id = $1', [id])).rows[0];
  assert.deepEqual({ ...reversal, amount_cents: Number(reversal.amount_cents) }, { reversal_type: 'refund', amount_cents: 5000 });
});

test('reabre conta encerrada por devolução sem apagar o histórico', async () => {
  const id = (await asUser(ester, "select id from receivables where description = 'Devolução recebível'")).rows[0].id;
  await asUser(ester, "select reopen_reversed_entry('receivable', $1, 'Novo atendimento acordado')", [id]);
  assert.equal((await asUser(ester, 'select status from receivables where id = $1', [id])).rows[0].status, 'pending');
  assert.equal((await asUser(ester, 'select count(*)::int as total from financial_reversals where target_id = $1', [id])).rows[0].total, 1);
});

test('correção de pagamento de gasto reabre a conta sem movimento oposto', async () => {
  const id = (await asUser(ester, "insert into expenses (description, category, amount_cents, competence_date, due_date, paid_at, responsibility, professional_id, payment_method, status) values ('Correção de gasto', 'Insumos', 4500, '2026-11-01', '2026-11-17', '2026-11-17', 'individual', $1, 'pix', 'paid') returning id", [p1])).rows[0].id;
  await asUser(ester, "select reverse_expense($1, 'correction', '2026-11-17', 'Pagamento lançado por engano')", [id]);
  const row = (await asUser(ester, 'select status, paid_at from expenses where id=$1', [id])).rows[0];
  assert.equal(row.status, 'pending');
  assert.equal(row.paid_at, null);
});

test('devolução de gasto encerra a conta e permite reabertura auditável', async () => {
  const id = (await asUser(ester, "insert into expenses (description, category, amount_cents, competence_date, due_date, paid_at, responsibility, professional_id, payment_method, status) values ('Devolução de gasto', 'Insumos', 5500, '2026-11-01', '2026-11-17', '2026-11-17', 'individual', $1, 'pix', 'paid') returning id", [p1])).rows[0].id;
  await asUser(ester, "select reverse_expense($1, 'refund', '2026-11-18', 'Fornecedor devolveu o valor')", [id]);
  assert.equal((await asUser(ester, 'select status from expenses where id=$1', [id])).rows[0].status, 'cancelled');
  await asUser(ester, "select reopen_reversed_entry('expense', $1, 'Nova cobrança do fornecedor')", [id]);
  assert.equal((await asUser(ester, 'select status from expenses where id=$1', [id])).rows[0].status, 'pending');
});

test('não permite apagar lançamentos financeiros', async () => {
  await assert.rejects(asUser(ester, 'delete from receivables'), /permission denied/);
  await assert.rejects(asUser(ester, 'delete from payments'), /permission denied/);
  await assert.rejects(asUser(ester, 'delete from expenses'), /permission denied/);
});

test('dashboard financeiro é consolidado em uma única função segura', async () => {
  const result = await asUser(
    ester,
    "select get_financial_dashboard('2026-11-01', '2026-11-30') as dashboard",
  );
  const dashboard = result.rows[0].dashboard;

  assert.ok(Array.isArray(dashboard.receivables));
  assert.ok(Array.isArray(dashboard.cashPayments));
  assert.ok(Array.isArray(dashboard.expenses));
  assert.ok(Array.isArray(dashboard.clients));
  assert.ok(Array.isArray(dashboard.procedures));
  assert.ok(Array.isArray(dashboard.openReceivables));
  assert.ok(Array.isArray(dashboard.openExpenses));
  assert.ok(dashboard.receivables.some((item) => item.description === 'Atendimento teste'));
  assert.ok(dashboard.procedures.length > 0);
  assert.ok(dashboard.procedures.every((item) => item.professional_id === p1));
  assert.ok(dashboard.openReceivables.every((item) => Number(item.balance_cents) > 0));
  assert.ok(dashboard.openReceivables.every((item) => item.professional_id === p1));
  assert.ok(dashboard.openExpenses.every((item) => item.created_by === ester));
  assert.ok(dashboard.openExpenses.every((item) => ['planned', 'pending'].includes(item.status)));
});

test('função consolidada não vaza dados para conta sem vínculo', async () => {
  const result = await asUser(
    outsider,
    "select get_financial_dashboard('2026-11-01', '2026-11-30') as dashboard",
  );
  const dashboard = result.rows[0].dashboard;

  for (const rows of Object.values(dashboard)) assert.deepEqual(rows, []);
});
