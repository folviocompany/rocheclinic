import 'server-only';

import { requireMember } from '@/features/auth/data-access';
import type { Client } from '@/types/database';
import { clientPageCount, type ClientListQuery } from './query';

export const CLIENT_PAGE_SIZE = 20;

export type ClientListItem = Pick<
  Client,
  'id' | 'full_name' | 'phone_digits' | 'birth_date' | 'reference_professional_id' | 'notes' | 'whatsapp_allowed' | 'active'
>;

const clientColumns = 'id,full_name,phone_digits,birth_date,reference_professional_id,notes,whatsapp_allowed,active';

export async function getClientsPage(filters: ClientListQuery) {
  const { supabase } = await requireMember();

  function pageQuery(page: number) {
    let request = supabase
      .from('clients')
      .select(clientColumns, { count: 'exact' })
      .order('active', { ascending: false })
      .order('full_name')
      .range((page - 1) * CLIENT_PAGE_SIZE, page * CLIENT_PAGE_SIZE - 1);

    if (filters.query) {
      const phone = filters.query.replace(/\D/g, '');
      const conditions = [`full_name.ilike.%${filters.query}%`];
      if (phone) conditions.push(`phone_digits.ilike.%${phone}%`);
      request = request.or(conditions.join(','));
    }
    if (filters.professionalId) request = request.eq('reference_professional_id', filters.professionalId);
    return request;
  }

  const [initial, active] = await Promise.all([
    pageQuery(filters.page),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('active', true),
  ]);

  if (initial.error || active.error) throw new Error('Não foi possível carregar as clientes.');

  const total = initial.count ?? 0;
  const pageCount = clientPageCount(total, CLIENT_PAGE_SIZE);
  const page = Math.min(filters.page, pageCount);
  let clients = initial.data;

  if (page !== filters.page) {
    const corrected = await pageQuery(page);
    if (corrected.error) throw new Error('Não foi possível carregar as clientes.');
    clients = corrected.data;
  }

  return {
    clients: (clients ?? []) as ClientListItem[],
    total,
    activeCount: active.count ?? 0,
    page,
    pageCount,
  };
}
