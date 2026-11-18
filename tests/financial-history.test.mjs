import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectHistory } from '../src/features/finances/history.ts';

const items = Array.from({ length: 25 }, (_, i) => ({ id: String(i), description: i === 20 ? 'Manutenção' : 'Material', professional: i % 2 ? 'Ester' : 'Clínica', type: 'expense', status: i % 2 ? 'Pago' : 'Pendente', date: '2026-11-18', amount: 1000 }));
test('histórico permite alcançar registros além dos primeiros doze', () => {
  const result = selectHistory(items, {}, 3);
  assert.equal(result.total, 25);
  assert.equal(result.pages, 3);
  assert.deepEqual(result.items.map(item => item.id), ['24']);
});
test('busca ignora acentos e combina todos os filtros antes da paginação', () => {
  const result = selectHistory(items, { search: ' MANUTENCAO ', professional: 'Clínica', status: 'Pendente', type: 'expense' }, 1);
  assert.deepEqual(result.items.map(item => item.id), ['20']);
  assert.equal(selectHistory(items, { search: 'manutencao', professional: 'Ester' }, 1).total, 0);
});
test('ajusta página inválida ou esvaziada e não modifica os dados originais', () => {
  assert.equal(selectHistory(items, {}, 99).page, 3);
  assert.equal(selectHistory(items, {}, -5).page, 1);
  const empty = selectHistory(items, { search: 'inexistente' }, 3);
  assert.equal(empty.page, 1);
  assert.deepEqual(empty.items, []);
  assert.equal(items.length, 25);
  assert.equal(items[0].id, '0');
});
