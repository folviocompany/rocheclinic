import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('rotas privadas exibem feedback imediato durante a navegação', async () => {
  const loading = await source('src/app/(dashboard)/loading.tsx');
  assert.match(loading, /aria-label=["']Carregando página["']/);
  assert.match(loading, /skeleton/i);
});

test('ações não disparam refresh duplicado depois de revalidatePath', async () => {
  const managers = await Promise.all([
    source('src/app/(dashboard)/financeiro/financial-dashboard.tsx'),
    source('src/app/(dashboard)/clientes/client-manager.tsx'),
    source('src/app/(dashboard)/procedimentos/procedure-manager.tsx'),
  ]);

  for (const manager of managers) {
    assert.doesNotMatch(manager, /router\.refresh\(\)/);
  }
});

test('DAL valida o token de forma eficiente e busca perfil em paralelo', async () => {
  const dal = await source('src/features/auth/data-access.ts');
  assert.match(dal, /auth\.getClaims\(\)/);
  assert.match(dal, /Promise\.all\(\[/);
  assert.doesNotMatch(dal, /select\(['"]\*['"]\)/);
});

test('proxy de sessão não intercepta a página pública de login', async () => {
  const proxy = await source('src/proxy.ts');
  assert.match(proxy, /\(\?!login/);
  assert.match(proxy, /auth\.getClaims\(\)/);
});

test('financeiro usa uma única leitura consolidada no banco', async () => {
  const [page, repository] = await Promise.all([
    source('src/app/(dashboard)/financeiro/page.tsx'),
    source('src/features/finances/data-access.ts'),
  ]);

  assert.doesNotMatch(page, /\.from\(/);
  assert.match(page, /getFinancialDashboardData/);
  assert.match(repository, /\.rpc\(['"]get_financial_dashboard['"]/);
  assert.doesNotMatch(repository, /PGRST202/);
  assert.doesNotMatch(repository, /getLegacyFinancialDashboardData/);
});

test('gráficos pesados são carregados somente ao se aproximarem da tela', async () => {
  const [dashboard, deferred, charts] = await Promise.all([
    source('src/app/(dashboard)/financeiro/financial-dashboard.tsx'),
    source('src/app/(dashboard)/financeiro/deferred-financial-charts.tsx'),
    source('src/app/(dashboard)/financeiro/financial-charts.tsx'),
  ]);
  assert.doesNotMatch(dashboard, /from ['"]recharts['"]/);
  assert.match(deferred, /dynamic\([\s\S]*import\(['"]\.\/financial-charts['"]\)/);
  assert.match(deferred, /IntersectionObserver/);
  assert.match(charts, /from ['"]recharts['"]/);
});

test('consultas financeiras crescentes possuem índices seletivos', async () => {
  const migration = await source('supabase/migrations/202611180002_financial_performance_indexes.sql');
  assert.match(migration, /expense_recurrences\(created_by,next_occurrence_date\) where active/);
  assert.match(migration, /receivables\(professional_id,due_date\) where status in/);
  assert.match(migration, /expenses\(created_by,due_date\) where status in/);
});

test('funções da Vercel permanecem na mesma região do Supabase', async () => {
  const config = JSON.parse(await source('vercel.json'));
  assert.deepEqual(config.regions, ['iad1']);
});

test('contas a receber e a pagar compartilham os mesmos componentes visuais', async () => {
  const [receivable, payable, shared] = await Promise.all([
    source('src/app/(dashboard)/financeiro/accounts-receivable-panel.tsx'),
    source('src/app/(dashboard)/financeiro/accounts-payable-panel.tsx'),
    source('src/app/(dashboard)/financeiro/financial-account-ui.tsx'),
  ]);

  for (const panel of [receivable, payable]) {
    assert.match(panel, /FinancialAccountPanel/);
    assert.match(panel, /FinancialAccountRow/);
    assert.match(panel, /FinancialModal/);
    assert.match(panel, /FinancialField/);
    assert.doesNotMatch(panel, /function Field/);
  }

  assert.match(shared, /export function FinancialAccountPanel/);
  assert.match(shared, /export function FinancialAccountRow/);
  assert.match(shared, /export function FinancialModal/);
  assert.match(shared, /export function FinancialField/);
});

test('gasto pendente separa cancelamento de estorno e usa funções reparadas', async () => {
  const [payable, reversal, migration] = await Promise.all([
    source('src/app/(dashboard)/financeiro/accounts-payable-panel.tsx'),
    source('src/app/(dashboard)/financeiro/financial-reversal-panel.tsx'),
    source('supabase/migrations/202611220001_repair_payable_actions.sql'),
  ]);

  assert.match(payable, /secondaryActionLabel=["']Lançamento errado["']/);
  assert.match(reversal, /Somente valores já recebidos ou pagos/);
  assert.match(migration, /create or replace function public\.settle_expense[\s\S]*security definer/);
  assert.match(migration, /create or replace function public\.cancel_expense[\s\S]*security definer/);
  assert.match(migration, /updated_by\s*=\s*auth\.uid\(\)/);
});

test('exportação CSV usa a leitura consolidada e exige a camada autenticada', async () => {
  const route = await source('src/app/(dashboard)/financeiro/exportar/route.ts');
  assert.match(route, /getFinancialDashboardData/);
  assert.match(route, /buildFinancialCsv/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /no-store/);
});
