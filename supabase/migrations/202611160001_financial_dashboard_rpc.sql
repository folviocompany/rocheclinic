-- Consolida a leitura mensal do dashboard em uma única ida ao PostgREST.
-- SECURITY INVOKER é intencional: todas as consultas continuam sujeitas às RLS.
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
  active_clients as (
    select c.id, c.full_name
    from public.clients c
    where c.active
    order by c.full_name
  ),
  active_procedures as (
    select p.id, p.professional_id, p.name
    from public.procedures p
    where p.active
    order by p.name
  ),
  professional_rows as (
    select p.id, p.user_id
    from public.professionals p
  ),
  profile_rows as (
    select p.id, p.display_name
    from public.profiles p
    where p.active
  )
  select jsonb_build_object(
    'receivables', coalesce((select jsonb_agg(to_jsonb(r)) from period_receivables r), '[]'::jsonb),
    'cashPayments', coalesce((select jsonb_agg(to_jsonb(p)) from cash_payments p), '[]'::jsonb),
    'periodPayments', coalesce((select jsonb_agg(to_jsonb(p)) from period_payments p), '[]'::jsonb),
    'cashParents', coalesce((select jsonb_agg(to_jsonb(r)) from cash_parents r), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(to_jsonb(e)) from period_expenses e), '[]'::jsonb),
    'paidExpenses', coalesce((select jsonb_agg(to_jsonb(e)) from paid_expenses e), '[]'::jsonb),
    'clients', coalesce((select jsonb_agg(to_jsonb(c)) from active_clients c), '[]'::jsonb),
    'procedures', coalesce((select jsonb_agg(to_jsonb(p)) from active_procedures p), '[]'::jsonb),
    'professionals', coalesce((select jsonb_agg(to_jsonb(p)) from professional_rows p), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(to_jsonb(p)) from profile_rows p), '[]'::jsonb)
  );
$$;

revoke all on function public.get_financial_dashboard(date, date) from public, anon;
grant execute on function public.get_financial_dashboard(date, date) to authenticated;
