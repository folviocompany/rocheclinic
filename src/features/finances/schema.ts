import { z } from 'zod';

const moneyPattern = /^\d{1,7}([.,]\d{1,2})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const paymentMethods = ['pix', 'cash', 'debit_card', 'credit_card', 'transfer', 'other'] as const;

const money = (label: string, allowZero = false) => z.string().trim().regex(moneyPattern, `Informe ${label.toLowerCase()} válido.`).refine((value) => allowZero || moneyToCents(value) > 0, `${label} deve ser maior que zero.`);

export const revenueFormSchema = z.object({
  description: z.string().trim().min(2, 'Informe a descrição.').max(180),
  amount: money('Valor'),
  serviceDate: z.string().regex(datePattern, 'Informe a data do atendimento.'),
  dueDate: z.string().regex(datePattern, 'Informe o vencimento.'),
  clientId: z.union([z.literal(''), z.uuid()]),
  procedureId: z.union([z.literal(''), z.uuid()]),
  initialPayment: money('Valor recebido', true),
  paymentMethod: z.union([z.literal(''), z.enum(paymentMethods)]),
  paidAt: z.string().refine((value) => value === '' || datePattern.test(value), 'Informe a data do recebimento.'),
}).superRefine((value, ctx) => {
  const total = moneyToCents(value.amount);
  const paid = moneyToCents(value.initialPayment);
  if (paid > total) ctx.addIssue({ code: 'custom', path: ['initialPayment'], message: 'O recebido não pode superar o valor total.' });
  if (paid > 0 && !value.paymentMethod) ctx.addIssue({ code: 'custom', path: ['paymentMethod'], message: 'Informe a forma de pagamento.' });
  if (paid > 0 && !value.paidAt) ctx.addIssue({ code: 'custom', path: ['paidAt'], message: 'Informe a data do recebimento.' });
});

export const expenseFormSchema = z.object({
  description: z.string().trim().min(2, 'Informe a descrição.').max(180),
  category: z.string().trim().min(2, 'Informe a categoria.').max(80),
  amount: money('Valor'),
  competenceDate: z.string().regex(datePattern, 'Informe a competência.'),
  dueDate: z.string().regex(datePattern, 'Informe o vencimento.'),
  responsibility: z.enum(['individual', 'shared']),
  status: z.enum(['planned', 'pending', 'paid']),
  paidAt: z.string().refine((value) => value === '' || datePattern.test(value), 'Informe a data do pagamento.'),
  paymentMethod: z.union([z.literal(''), z.enum(paymentMethods)]),
  notes: z.string().trim().max(500),
}).superRefine((value, ctx) => {
  if (value.status === 'paid' && !value.paidAt) ctx.addIssue({ code: 'custom', path: ['paidAt'], message: 'Informe a data do pagamento.' });
  if (value.status === 'paid' && !value.paymentMethod) ctx.addIssue({ code: 'custom', path: ['paymentMethod'], message: 'Informe a forma de pagamento.' });
});

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

export type RevenueFormValues = z.infer<typeof revenueFormSchema>;
export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
export type ExpenseSettlementFormValues = z.infer<typeof expenseSettlementFormSchema>;

export function moneyToCents(value: string) { return Math.round(Number((value || '0').replace(',', '.')) * 100); }
export function formatMoney(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
