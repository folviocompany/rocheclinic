begin;

create function public.settle_expense(
  p_expense_id uuid,
  p_paid_at date,
  p_payment_method text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid;
  current_status text;
begin
  if p_expense_id is null or p_paid_at is null or p_payment_method is null then
    raise exception 'Dados do pagamento incompletos';
  end if;

  select e.created_by, e.status
    into owner_id, current_status
  from public.expenses e
  where e.id = p_expense_id;

  if not found then raise exception 'Conta a pagar não encontrada'; end if;
  if owner_id <> auth.uid() then raise exception 'Quitação não autorizada'; end if;
  if current_status not in ('planned', 'pending') then raise exception 'A conta não está em aberto ou já foi paga'; end if;

  update public.expenses
  set status = 'paid', paid_at = p_paid_at, payment_method = p_payment_method
  where id = p_expense_id;

  return p_expense_id;
end;
$$;

revoke all on function public.settle_expense(uuid, date, text) from public, anon;
grant execute on function public.settle_expense(uuid, date, text) to authenticated;

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
  open_expenses as (
    select e.id, e.description, e.category, e.amount_cents, e.due_date,
      e.responsibility, e.status, e.created_by
    from public.expenses e
    where e.created_by = auth.uid()
      and e.status in ('planned', 'pending')
    order by e.due_date, e.created_at
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
    'openExpenses', coalesce((select jsonb_agg(to_jsonb(e)) from open_expenses e), '[]'::jsonb),
    'clients', coalesce((select jsonb_agg(to_jsonb(c)) from active_clients c), '[]'::jsonb),
    'procedures', coalesce((select jsonb_agg(to_jsonb(p)) from active_procedures p), '[]'::jsonb),
    'professionals', coalesce((select jsonb_agg(to_jsonb(p)) from professional_rows p), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(to_jsonb(p)) from profile_rows p), '[]'::jsonb)
  );
$$;

revoke all on function public.get_financial_dashboard(date, date) from public, anon;
grant execute on function public.get_financial_dashboard(date, date) to authenticated;

commit;
