import 'server-only';

import { z } from 'zod';
import { requireMember } from '@/features/auth/data-access';
import type { FinancialDashboardPayload } from './dashboard';
import { getLegacyFinancialDashboardData } from './legacy-data-access';

const amount = z.coerce.number().int();
const receivable = z.object({ id: z.string(), professional_id: z.string(), description: z.string(), amount_cents: amount, service_date: z.string(), status: z.string() });
const cashPayment = z.object({ id: z.string(), receivable_id: z.string(), amount_cents: amount, paid_at: z.string() });
const periodPayment = z.object({ receivable_id: z.string(), amount_cents: amount });
const cashParent = z.object({ id: z.string(), professional_id: z.string(), description: z.string() });
const expense = z.object({ id: z.string(), description: z.string(), amount_cents: amount, competence_date: z.string(), paid_at: z.string().nullable(), responsibility: z.string(), professional_id: z.string().nullable(), status: z.string() });

const payloadSchema = z.object({
  receivables: z.array(receivable),
  cashPayments: z.array(cashPayment),
  periodPayments: z.array(periodPayment),
  cashParents: z.array(cashParent),
  expenses: z.array(expense),
  paidExpenses: z.array(expense),
  professionals: z.array(z.object({ id: z.string(), user_id: z.string() })),
  profiles: z.array(z.object({ id: z.string(), display_name: z.string() })),
  clients: z.array(z.object({ id: z.string(), full_name: z.string() })),
  procedures: z.array(z.object({ id: z.string(), professional_id: z.string(), name: z.string() })),
});

export async function getFinancialDashboardData(start: string, end: string): Promise<FinancialDashboardPayload> {
  const { supabase, professional } = await requireMember();
  const { data, error } = await supabase.rpc('get_financial_dashboard', { p_start: start, p_end: end });

  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return getLegacyFinancialDashboardData({
      supabase,
      professionalId: professional.id,
      start,
      end,
    });
  }
  if (error) throw new Error('Não foi possível carregar o financeiro consolidado.');

  const parsed = payloadSchema.safeParse(data);
  if (!parsed.success) throw new Error('O banco retornou um formato financeiro inesperado.');
  return parsed.data;
}
