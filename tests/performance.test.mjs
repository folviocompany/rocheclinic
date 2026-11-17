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
  assert.match(repository, /PGRST202/);
  assert.match(repository, /getLegacyFinancialDashboardData/);
});
