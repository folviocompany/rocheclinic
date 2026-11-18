begin;

create table public.financial_reversals (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('receivable', 'expense')),
  target_id uuid not null,
  reversal_type text not null check (reversal_type in ('correction', 'refund')),
  amount_cents bigint not null check (amount_cents > 0),
  effective_date date not null,
  original_paid_at date,
  reason text not null check (length(trim(reason)) between 3 and 300),
  reopened_at timestamptz,
  reopened_by uuid references public.profiles(id) on delete restrict,
  reopen_reason text check (length(trim(reopen_reason)) between 3 and 300),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (target_type, target_id)
);

alter table public.financial_reversals enable row level security;
revoke all on public.financial_reversals from anon, authenticated;
grant select on public.financial_reversals to authenticated;
create policy reversals_read_member on public.financial_reversals for select to authenticated using ((select public.is_active_member()));
create trigger financial_reversals_audit after insert or update or delete on public.financial_reversals for each row execute function public.audit_change();

create function public.reverse_receivable(p_id uuid, p_type text, p_date date, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; current_status text; paid bigint; new_id uuid;
begin
  if not public.is_active_member() then raise exception 'Usuária inativa'; end if;
  if p_type not in ('correction','refund') or length(trim(p_reason)) not between 3 and 300 then raise exception 'Dados inválidos'; end if;
  select professional_id, status into owner_id, current_status from public.receivables where id = p_id for update;
  if not found or owner_id <> public.own_professional_id() then raise exception 'Estorno não autorizado'; end if;
  select coalesce(sum(amount_cents),0) into paid from public.payments where receivable_id = p_id;
  if paid < 1 or current_status not in ('paid','partially_paid') then raise exception 'Recebível sem valor para estornar'; end if;
  insert into public.financial_reversals(target_type,target_id,reversal_type,amount_cents,effective_date,reason)
  values('receivable',p_id,p_type,paid,p_date,trim(p_reason)) returning id into new_id;
  if p_type = 'correction' then
    update public.receivables set status='pending' where id=p_id;
  else
    update public.receivables set status='cancelled', cancellation_reason=trim(p_reason), cancelled_at=now(), cancelled_by=auth.uid() where id=p_id;
  end if;
  return new_id;
end; $$;

create function public.reopen_reversed_entry(p_target_type text, p_target_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare reversal_id uuid; owner_id uuid;
begin
  if not public.is_active_member() or length(trim(p_reason)) not between 3 and 300 then raise exception 'Dados inválidos'; end if;
  if p_target_type = 'receivable' then
    select r.id, e.professional_id into reversal_id, owner_id from public.financial_reversals r join public.receivables e on e.id=r.target_id
    where r.target_type=p_target_type and r.target_id=p_target_id and r.reversal_type='refund' and r.reopened_at is null for update of r;
    if not found or owner_id <> public.own_professional_id() then raise exception 'Reabertura não autorizada'; end if;
  elsif p_target_type = 'expense' then
    select r.id, e.created_by into reversal_id, owner_id from public.financial_reversals r join public.expenses e on e.id=r.target_id
    where r.target_type=p_target_type and r.target_id=p_target_id and r.reversal_type='refund' and r.reopened_at is null for update of r;
    if not found or owner_id <> auth.uid() then raise exception 'Reabertura não autorizada'; end if;
  else raise exception 'Tipo inválido'; end if;
  update public.financial_reversals set reopened_at=now(), reopened_by=auth.uid(), reopen_reason=trim(p_reason) where id=reversal_id;
  if p_target_type='receivable' then update public.receivables set status='pending', cancellation_reason=null, cancelled_at=null, cancelled_by=null where id=p_target_id;
  else update public.expenses set status='pending', cancellation_reason=null, cancelled_at=null, cancelled_by=null where id=p_target_id; end if;
  return reversal_id;
end; $$;

create function public.reverse_expense(p_id uuid, p_type text, p_date date, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; current_status text; total bigint; original_date date; new_id uuid;
begin
  if not public.is_active_member() then raise exception 'Usuária inativa'; end if;
  if p_type not in ('correction','refund') or length(trim(p_reason)) not between 3 and 300 then raise exception 'Dados inválidos'; end if;
  select created_by,status,amount_cents,paid_at into owner_id,current_status,total,original_date from public.expenses where id=p_id for update;
  if not found or owner_id<>auth.uid() then raise exception 'Estorno não autorizado'; end if;
  if current_status<>'paid' then raise exception 'Gasto sem pagamento para estornar'; end if;
  insert into public.financial_reversals(target_type,target_id,reversal_type,amount_cents,effective_date,original_paid_at,reason)
  values('expense',p_id,p_type,total,p_date,original_date,trim(p_reason)) returning id into new_id;
  if p_type='correction' then
    update public.expenses set status='pending',paid_at=null,payment_method=null where id=p_id;
  else
    update public.expenses set status='cancelled',paid_at=null,payment_method=null,cancellation_reason=trim(p_reason),cancelled_at=now(),cancelled_by=auth.uid() where id=p_id;
  end if;
  return new_id;
end; $$;

revoke all on function public.reverse_receivable(uuid,text,date,text) from public, anon;
revoke all on function public.reopen_reversed_entry(text,uuid,text) from public, anon;
grant execute on function public.reverse_receivable(uuid,text,date,text) to authenticated;
grant execute on function public.reopen_reversed_entry(text,uuid,text) to authenticated;
revoke all on function public.reverse_expense(uuid,text,date,text) from public, anon;
grant execute on function public.reverse_expense(uuid,text,date,text) to authenticated;

alter function public.get_financial_dashboard(date, date) rename to get_financial_dashboard_base;

create function public.get_financial_dashboard(p_start date, p_end date) returns jsonb
language sql stable security invoker set search_path='' as $$
  with base as (
    select public.get_financial_dashboard_base(p_start,p_end) as data
  ),
  active_cash_payments as (
    select p.id,p.receivable_id,p.amount_cents,p.paid_at
    from public.payments p
    where p.paid_at between p_start and p_end
      and not exists (select 1 from public.financial_reversals r where r.target_type='receivable' and r.target_id=p.receivable_id and r.reversal_type='correction')
  ),
  active_period_payments as (
    select p.receivable_id,p.amount_cents
    from public.payments p join public.receivables e on e.id=p.receivable_id
    where e.service_date between p_start and p_end and e.status<>'cancelled'
      and not exists (select 1 from public.financial_reversals r where r.target_type='receivable' and r.target_id=p.receivable_id)
  ),
  effective_paid_expenses as (
    select e.id,e.description,e.amount_cents,e.competence_date,e.paid_at,e.responsibility,e.professional_id,e.status
    from public.expenses e where e.status='paid' and e.paid_at between p_start and p_end
    union all
    select e.id,e.description,r.amount_cents,e.competence_date,r.original_paid_at,e.responsibility,e.professional_id,'reversed'
    from public.financial_reversals r join public.expenses e on e.id=r.target_id
    where r.target_type='expense' and r.reversal_type='refund' and r.original_paid_at between p_start and p_end
  ),
  cash_reversals as (
    select r.id,r.target_type,r.target_id,r.amount_cents,r.effective_date,r.reversal_type,
      case when r.target_type='receivable' then e.description else x.description end as description,
      e.professional_id, x.responsibility, x.professional_id as expense_professional_id
    from public.financial_reversals r
    left join public.receivables e on r.target_type='receivable' and e.id=r.target_id
    left join public.expenses x on r.target_type='expense' and x.id=r.target_id
    where r.reversal_type='refund' and r.effective_date between p_start and p_end
  ),
  corrected_open_receivables as (
    select e.id,e.professional_id,e.description,c.full_name as client_name,e.amount_cents,
      case when exists(select 1 from public.financial_reversals r where r.target_type='receivable' and r.target_id=e.id) then 0 else coalesce(sum(p.amount_cents),0) end::bigint as paid_cents,
      case when exists(select 1 from public.financial_reversals r where r.target_type='receivable' and r.target_id=e.id) then e.amount_cents else e.amount_cents-coalesce(sum(p.amount_cents),0) end::bigint as balance_cents,
      e.due_date,e.status
    from public.receivables e left join public.payments p on p.receivable_id=e.id left join public.clients c on c.id=e.client_id
    where e.professional_id=public.own_professional_id() and e.status in ('pending','partially_paid')
    group by e.id,c.full_name order by e.due_date,e.created_at
  ),
  reversible_entries as (
    select e.id,'receivable'::text as entry_type,e.description,coalesce(sum(p.amount_cents),0)::bigint as amount_cents
    from public.receivables e join public.payments p on p.receivable_id=e.id
    where e.professional_id=public.own_professional_id() and e.status in ('paid','partially_paid')
      and not exists(select 1 from public.financial_reversals r where r.target_type='receivable' and r.target_id=e.id)
    group by e.id
    union all
    select e.id,'expense',e.description,e.amount_cents from public.expenses e
    where e.created_by=auth.uid() and e.status='paid'
      and not exists(select 1 from public.financial_reversals r where r.target_type='expense' and r.target_id=e.id)
  ), reopenable_entries as (
    select r.target_id as id,r.target_type as entry_type,case when r.target_type='receivable' then e.description else x.description end as description
    from public.financial_reversals r left join public.receivables e on r.target_type='receivable' and e.id=r.target_id left join public.expenses x on r.target_type='expense' and x.id=r.target_id
    where r.reversal_type='refund' and r.reopened_at is null and ((r.target_type='receivable' and e.professional_id=public.own_professional_id()) or (r.target_type='expense' and x.created_by=auth.uid()))
  )
  select (select data from base) || jsonb_build_object(
    'cashPayments',coalesce((select jsonb_agg(to_jsonb(x)) from active_cash_payments x),'[]'::jsonb),
    'periodPayments',coalesce((select jsonb_agg(to_jsonb(x)) from active_period_payments x),'[]'::jsonb),
    'paidExpenses',coalesce((select jsonb_agg(to_jsonb(x)) from effective_paid_expenses x),'[]'::jsonb),
    'cashReversals',coalesce((select jsonb_agg(to_jsonb(x)) from cash_reversals x),'[]'::jsonb),
    'openReceivables',coalesce((select jsonb_agg(to_jsonb(x)) from corrected_open_receivables x),'[]'::jsonb),
    'reversibleEntries',coalesce((select jsonb_agg(to_jsonb(x)) from reversible_entries x),'[]'::jsonb),
    'reopenableEntries',coalesce((select jsonb_agg(to_jsonb(x)) from reopenable_entries x),'[]'::jsonb)
  );
$$;
revoke all on function public.get_financial_dashboard(date,date) from public,anon;
grant execute on function public.get_financial_dashboard(date,date) to authenticated;

commit;
