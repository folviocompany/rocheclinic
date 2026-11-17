'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireMember } from '@/features/auth/data-access';
import { expenseFormSchema, expenseSettlementFormSchema, moneyToCents, paymentFormSchema, revenueFormSchema, type ExpenseFormValues, type ExpenseSettlementFormValues, type PaymentFormValues, type RevenueFormValues } from '@/features/finances/schema';

type FinancialActionResult<T> = { ok: boolean; message: string; fieldErrors?: Partial<Record<keyof T, string>> };

function validationFailure<T>(error: z.ZodError): FinancialActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { ok: false, message: 'Revise os campos destacados.', fieldErrors: fieldErrors as Partial<Record<keyof T, string>> };
}

export async function registerRevenue(input: RevenueFormValues): Promise<FinancialActionResult<RevenueFormValues>> {
  const parsed = revenueFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { supabase } = await requireMember();
  const values = parsed.data;
  const { error } = await supabase.rpc('register_receivable', {
    p_description: values.description,
    p_amount_cents: moneyToCents(values.amount),
    p_service_date: values.serviceDate,
    p_due_date: values.dueDate,
    p_client_id: values.clientId || null,
    p_procedure_id: values.procedureId || null,
    p_initial_payment_cents: moneyToCents(values.initialPayment),
    p_payment_method: values.paymentMethod || null,
    p_paid_at: values.paidAt || null,
  });
  if (error) return { ok: false, message: 'Não foi possível registrar o ganho. Verifique os dados e tente novamente.' };
  revalidatePath('/financeiro');
  return { ok: true, message: 'Ganho registrado com segurança.' };
}

export async function registerExpense(input: ExpenseFormValues): Promise<FinancialActionResult<ExpenseFormValues>> {
  const parsed = expenseFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { supabase, professional } = await requireMember();
  const values = parsed.data;
  const { error } = await supabase.from('expenses').insert({
    description: values.description,
    category: values.category,
    amount_cents: moneyToCents(values.amount),
    competence_date: values.competenceDate,
    due_date: values.dueDate,
    paid_at: values.status === 'paid' ? values.paidAt : null,
    responsibility: values.responsibility,
    professional_id: values.responsibility === 'individual' ? professional.id : null,
    payment_method: values.status === 'paid' ? values.paymentMethod || null : null,
    status: values.status,
    notes: values.notes || null,
  });
  if (error) return { ok: false, message: 'Não foi possível registrar o gasto. Verifique os dados e tente novamente.' };
  revalidatePath('/financeiro');
  return { ok: true, message: 'Gasto registrado com segurança.' };
}

export async function registerPayment(input: PaymentFormValues): Promise<FinancialActionResult<PaymentFormValues>> {
  const parsed = paymentFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { supabase } = await requireMember();
  const values = parsed.data;
  const { error } = await supabase.rpc('register_payment', {
    p_receivable_id: values.receivableId,
    p_amount_cents: moneyToCents(values.amount),
    p_paid_at: values.paidAt,
    p_payment_method: values.paymentMethod,
    p_notes: values.notes || null,
  });
  if (error) return { ok: false, message: 'Não foi possível registrar o recebimento. Confira o saldo e tente novamente.' };
  revalidatePath('/financeiro');
  return { ok: true, message: 'Recebimento registrado com segurança.' };
}

export async function settleExpense(input: ExpenseSettlementFormValues): Promise<FinancialActionResult<ExpenseSettlementFormValues>> {
  const parsed = expenseSettlementFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { supabase } = await requireMember();
  const values = parsed.data;
  const { error } = await supabase.rpc('settle_expense', {
    p_expense_id: values.expenseId,
    p_paid_at: values.paidAt,
    p_payment_method: values.paymentMethod,
  });
  if (error) return { ok: false, message: 'Não foi possível quitar o gasto. Confira a situação e tente novamente.' };
  revalidatePath('/financeiro');
  return { ok: true, message: 'Gasto quitado e saída de caixa registrada.' };
}
