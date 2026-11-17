begin;

create function public.register_payment(
  p_receivable_id uuid,
  p_amount_cents bigint,
  p_paid_at date,
  p_payment_method text,
  p_notes text default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if p_receivable_id is null or p_amount_cents < 1 or p_paid_at is null or p_payment_method is null then
    raise exception 'Dados do recebimento incompletos';
  end if;

  insert into public.payments (receivable_id, amount_cents, paid_at, payment_method, notes)
  values (p_receivable_id, p_amount_cents, p_paid_at, p_payment_method, nullif(trim(p_notes), ''))
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.register_payment(uuid, bigint, date, text, text) from public, anon;
grant execute on function public.register_payment(uuid, bigint, date, text, text) to authenticated;

-- Mantém a leitura do dashboard em uma única chamada e inclui somente os
-- recebíveis abertos da profissional autenticada para a ação de recebimento.
create or replace function public.get_financial_dashboard(p_start date, p_end date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with period_receivables as (
    select r.id, r.professional_id, r.description, r.amount_cents, r.service_date, r.status
    from public.receivables r
    where r.service_date between p_start and p_end
      and r.status <> 'cancelled'
  ),
  cash_payments as (
    select p.id, p.receivable_id, p.amount_cents, p.paid_at
    from public.payments p
    where p.paid_at between p_start and p_end
  ),
  period_payments as (
    select p.receivable_id, p.amount_cents
    from public.payments p
    join period_receivables r on r.id = p.receivable_id
  ),
  cash_parents as (
    select distinct r.id, r.professional_id, r.description
    from public.receivables r
    join cash_payments p on p.receivable_id = r.id
  ),
  period_expenses as (
    select e.id, e.description, e.amount_cents, e.competence_date, e.paid_at,
      e.responsibility, e.professional_id, e.status
    from public.expenses e
    where e.competence_date between p_start and p_end
      and e.status <> 'cancelled'
  ),
  paid_expenses as (
    select e.id, e.description, e.amount_cents, e.competence_date, e.paid_at,
      e.responsibility, e.professional_id, e.status
    from public.expenses e
    where e.status = 'paid'
      and e.paid_at between p_start and p_end
  ),
  open_receivables as (
    select r.id, r.professional_id, r.description, c.full_name as client_name,
      r.amount_cents,
      coalesce(sum(p.amount_cents), 0)::bigint as paid_cents,
      (r.amount_cents - coalesce(sum(p.amount_cents), 0))::bigint as balance_cents,
      r.due_date, r.status
    from public.receivables r
    left join public.payments p on p.receivable_id = r.id
    left join public.clients c on c.id = r.client_id
    where r.professional_id = public.own_professional_id()
      and r.status in ('pending', 'partially_paid')
    group by r.id, c.full_name
    having r.amount_cents - coalesce(sum(p.amount_cents), 0) > 0
    order by r.due_date, r.created_at
  ),
  active_clients as (
    select c.id, c.full_name from public.clients c where c.active order by c.full_name
  ),
  active_procedures as (
    select p.id, p.professional_id, p.name from public.procedures p where p.active order by p.name
  ),
  professional_rows as (
    select p.id, p.user_id from public.professionals p
  ),
  profile_rows as (
    select p.id, p.display_name from public.profiles p where p.active
  )
  select jsonb_build_object(
    'receivables', coalesce((select jsonb_agg(to_jsonb(r)) from period_receivables r), '[]'::jsonb),
    'cashPayments', coalesce((select jsonb_agg(to_jsonb(p)) from cash_payments p), '[]'::jsonb),
    'periodPayments', coalesce((select jsonb_agg(to_jsonb(p)) from period_payments p), '[]'::jsonb),
    'cashParents', coalesce((select jsonb_agg(to_jsonb(r)) from cash_parents r), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(to_jsonb(e)) from period_expenses e), '[]'::jsonb),
    'paidExpenses', coalesce((select jsonb_agg(to_jsonb(e)) from paid_expenses e), '[]'::jsonb),
    'openReceivables', coalesce((select jsonb_agg(to_jsonb(r)) from open_receivables r), '[]'::jsonb),
    'clients', coalesce((select jsonb_agg(to_jsonb(c)) from active_clients c), '[]'::jsonb),
    'procedures', coalesce((select jsonb_agg(to_jsonb(p)) from active_procedures p), '[]'::jsonb),
    'professionals', coalesce((select jsonb_agg(to_jsonb(p)) from professional_rows p), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(to_jsonb(p)) from profile_rows p), '[]'::jsonb)
  );
$$;

revoke all on function public.get_financial_dashboard(date, date) from public, anon;
grant execute on function public.get_financial_dashboard(date, date) to authenticated;

commit;
