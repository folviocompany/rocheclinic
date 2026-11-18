import { z } from 'zod';

const moneyPattern = /^\d{1,7}([.,]\d{1,2})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const paymentMethods = ['pix', 'cash', 'debit_card', 'credit_card', 'transfer', 'other'] as const;

const money = (label: string, allowZero = false) => z.string().trim().regex(moneyPattern, `Informe ${label.toLowerCase()} válido.`).refine((value) => allowZero || moneyToCents(value) > 0, `${label} deve ser maior que zero.`);

export const revenueFormSchema = z.object({
  description: z.string().trim().min(2, 'Informe a descrição.').max(180),
  amount: money('Valor'),
  launchDate: z.string().regex(datePattern, 'Informe a data do lançamento.'),
  clientId: z.union([z.literal(''), z.uuid()]),
  procedureId: z.union([z.literal(''), z.uuid()]),
  status: z.enum(['pending', 'received']),
  paymentMethod: z.union([z.literal(''), z.enum(paymentMethods)]),
}).superRefine((value, ctx) => {
  if (value.status === 'received' && !value.paymentMethod) ctx.addIssue({ code: 'custom', path: ['paymentMethod'], message: 'Informe a forma de pagamento.' });
});

export const expenseFormSchema = z.object({
  description: z.string().trim().min(2, 'Informe a descrição.').max(180),
  category: z.string().trim().min(2, 'Informe a categoria.').max(80),
  amount: money('Valor'),
  launchDate: z.string().regex(datePattern, 'Informe a data do lançamento.'),
  responsibility: z.enum(['individual', 'shared']),
  status: z.enum(['pending', 'paid']),
  paymentMethod: z.union([z.literal(''), z.enum(paymentMethods)]),
  notes: z.string().trim().max(500),
  recurring: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.status === 'paid' && !value.paymentMethod) ctx.addIssue({ code: 'custom', path: ['paymentMethod'], message: 'Informe a forma de pagamento.' });
});

export const expenseCategoryFormSchema = z.object({ name: z.string().trim().min(2, 'Informe o nome da categoria.').max(80) });
export type ExpenseCategoryFormValues = z.infer<typeof expenseCategoryFormSchema>;

export const expenseRecurrenceFormSchema = z.object({
  id: z.uuid(),
  description: z.string().trim().min(2, 'Informe a descrição.').max(180),
  categoryId: z.uuid('Selecione a categoria.'),
  amount: money('Valor'),
  responsibility: z.enum(['individual', 'shared']),
});
export type ExpenseRecurrenceFormValues = z.infer<typeof expenseRecurrenceFormSchema>;

export const paymentFormSchema = z.object({
  receivableId: z.uuid('Selecione uma conta a receber.'),
  amount: money('Valor recebido'),
  paidAt: z.string().regex(datePattern, 'Informe a data do recebimento.'),
  paymentMethod: z.enum(paymentMethods, 'Informe a forma de pagamento.'),
  notes: z.string().trim().max(300),
});

export const expenseSettlementFormSchema = z.object({
  expenseId: z.uuid('Selecione uma conta a pagar.'),
  paidAt: z.string().regex(datePattern, 'Informe a data do pagamento.'),
  paymentMethod: z.enum(paymentMethods, 'Informe a forma de pagamento.'),
});

export const financialCancellationSchema = z.object({
  entryId: z.uuid('Selecione um lançamento.'),
  entryType: z.enum(['receivable', 'expense']),
  reason: z.string().trim().min(3, 'Explique o motivo do cancelamento.').max(300),
});

export const financialReversalSchema = z.object({
  entryId: z.uuid('Selecione um lançamento.'),
  entryType: z.enum(['receivable', 'expense']),
  reversalType: z.enum(['correction', 'refund']),
  effectiveDate: z.string().regex(datePattern, 'Informe a data do estorno.'),
  reason: z.string().trim().min(3, 'Explique o motivo do estorno.').max(300),
});
export const financialReopenSchema = z.object({ entryId: z.uuid(), entryType: z.enum(['receivable', 'expense']), reason: z.string().trim().min(3).max(300) });

export type RevenueFormValues = z.infer<typeof revenueFormSchema>;
export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
export type ExpenseSettlementFormValues = z.infer<typeof expenseSettlementFormSchema>;
export type FinancialCancellationValues = z.infer<typeof financialCancellationSchema>;
export type FinancialReversalValues = z.infer<typeof financialReversalSchema>;
export type FinancialReopenValues = z.infer<typeof financialReopenSchema>;

export function moneyToCents(value: string) { return Math.round(Number((value || '0').replace(',', '.')) * 100); }
export function formatMoney(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
