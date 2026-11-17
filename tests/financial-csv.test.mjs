import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFinancialCsv } from '../src/features/finances/csv.ts';

test('exporta todas as movimentações com cabeçalho e valores brasileiros', () => {
  const csv = buildFinancialCsv([
    { id: '1', type: 'revenue', description: 'Atendimento', date: '2026-11-15', amount: 30000, status: 'Parcial', professional: 'Ester' },
    { id: '2', type: 'expense', description: 'Material', date: '2026-11-16', amount: 5050, status: 'Pago', professional: 'Clínica' },
  ]);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'Data;Tipo;Descrição;Profissional;Status;Valor (R$)');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /15\/11\/2026;Receita;Atendimento;Ester;Parcial;300,00/);
  assert.match(lines[2], /16\/11\/2026;Gasto;Material;Clínica;Pago;50,50/);
});

test('escapa separadores, aspas e fórmulas perigosas para planilhas', () => {
  const csv = buildFinancialCsv([
    { id: '1', type: 'payment', description: '=CMD("teste"); detalhe', date: '2026-11-15', amount: 1000, status: '@Recebido', professional: '+Usuária' },
  ]);
  assert.match(csv, /"'=CMD\(""teste""\); detalhe"/);
  assert.match(csv, /;'\+Usuária;'@Recebido;/);
});
