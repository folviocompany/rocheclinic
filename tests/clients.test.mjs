import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientFormSchema, formatPhone, normalizePhone } from '../src/features/clients/schema.ts';
import { clientListQuery, clientPageCount } from '../src/features/clients/query.ts';

const validClient = { fullName: 'Maria de Teste', phone: '(92) 99999-9999', birthDate: '', referenceProfessionalId: '', notes: '', whatsappAllowed: true, active: true };

test('normaliza e formata telefone brasileiro', () => {
  assert.equal(normalizePhone('(92) 99999-9999'), '92999999999');
  assert.equal(formatPhone('92999999999'), '(92) 99999-9999');
  assert.equal(formatPhone('5592999999999'), '(92) 99999-9999');
});

test('aceita cadastro administrativo mínimo', () => {
  assert.equal(clientFormSchema.safeParse(validClient).success, true);
});

test('rejeita telefone e observações fora dos limites', () => {
  assert.equal(clientFormSchema.safeParse({ ...validClient, phone: '123' }).success, false);
  assert.equal(clientFormSchema.safeParse({ ...validClient, notes: 'x'.repeat(1001) }).success, false);
});

test('normaliza busca, profissional e página da listagem', () => {
  assert.deepEqual(
    clientListQuery({ q: '  Maria, (Teste)%  ', professional: 'not-a-uuid', page: '-4' }),
    { query: 'Maria Teste', professionalId: '', page: 1 },
  );
  assert.deepEqual(
    clientListQuery({ q: '92999', professional: '7a6e1e31-c5de-4d89-9eab-9ceebf876104', page: '3' }),
    { query: '92999', professionalId: '7a6e1e31-c5de-4d89-9eab-9ceebf876104', page: 3 },
  );
});

test('calcula paginação sem produzir página zero', () => {
  assert.equal(clientPageCount(0, 20), 1);
  assert.equal(clientPageCount(41, 20), 3);
});
