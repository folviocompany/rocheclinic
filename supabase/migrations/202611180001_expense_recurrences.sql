begin;

create table public.expense_recurrences (
  id uuid primary key default gen_random_uuid(),
  description text not null check (length(trim(description)) between 2 and 180),
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  amount_cents bigint not null check (amount_cents between 1 and 999999999),
  responsibility text not null check (responsibility in ('individual','shared')),
  professional_id uuid references public.professionals(id) on delete restrict,
  day_of_month smallint not null check (day_of_month between 1 and 31),
  next_occurrence_date date not null,
  active boolean not null default true,
  stopped_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_recurrences_owner check ((responsibility='shared' and professional_id is null) or (responsibility='individual' and professional_id is not null))
);

alter table public.expenses add column recurrence_id uuid references public.expense_recurrences(id) on delete restrict;
alter table public.expenses add column occurrence_date date;
create unique index expenses_recurrence_occurrence_idx on public.expenses(recurrence_id,occurrence_date) where recurrence_id is not null;

create function public.next_monthly_date(p_date date,p_day integer) returns date language sql immutable set search_path='' as $$
  select (date_trunc('month',p_date)+interval '1 month'+(least(p_day,extract(day from (date_trunc('month',p_date)+interval '2 months - 1 day'))::integer)-1)*interval '1 day')::date;
$$;
revoke all on function public.next_monthly_date(date,integer) from public;
grant execute on function public.next_monthly_date(date,integer) to authenticated;

alter table public.expense_recurrences enable row level security;
revoke all on public.expense_recurrences from anon,authenticated;
grant select on public.expense_recurrences to authenticated;
grant insert(description,category_id,amount_cents,responsibility,professional_id,day_of_month,next_occurrence_date) on public.expense_recurrences to authenticated;
grant update(description,category_id,amount_cents,responsibility,professional_id,next_occurrence_date,active,stopped_at) on public.expense_recurrences to authenticated;
grant insert(recurrence_id,occurrence_date),update(recurrence_id,occurrence_date) on public.expenses to authenticated;
create policy expense_recurrences_read on public.expense_recurrences for select to authenticated using ((select public.is_active_member()));
create policy expense_recurrences_insert on public.expense_recurrences for insert to authenticated with check ((select public.is_active_member()) and created_by=auth.uid() and (responsibility='shared' or professional_id=(select public.own_professional_id())));
create policy expense_recurrences_update on public.expense_recurrences for update to authenticated using (created_by=auth.uid()) with check (created_by=auth.uid() and (responsibility='shared' or professional_id=(select public.own_professional_id())));
create trigger expense_recurrences_audit_fields before insert or update on public.expense_recurrences for each row execute function public.set_financial_audit_fields();
create trigger expense_recurrences_audit after insert or update or delete on public.expense_recurrences for each row execute function public.audit_change();

create function public.stop_recurrences_for_inactive_category() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.active and not new.active then
    update public.expense_recurrences set active=false,stopped_at=now() where category_id=new.id and active;
  end if;
  return new;
end; $$;
revoke all on function public.stop_recurrences_for_inactive_category() from public;
create trigger expense_categories_stop_recurrences after update of active on public.expense_categories for each row execute function public.stop_recurrences_for_inactive_category();

create function public.register_expense(p_description text,p_category_id uuid,p_amount_cents bigint,p_launch_date date,p_responsibility text,p_status text,p_payment_method text,p_notes text,p_recurring boolean) returns uuid
language plpgsql security invoker set search_path='' as $$
declare own_prof uuid; recurrence uuid; new_id uuid; category_name text;
begin
  own_prof:=public.own_professional_id();
  if own_prof is null then raise exception 'Profissional não autorizada'; end if;
  if p_amount_cents<1 or p_responsibility not in ('individual','shared') or p_status not in ('pending','paid') then raise exception 'Dados inválidos'; end if;
  if p_status='paid' and p_payment_method is null then raise exception 'Forma de pagamento obrigatória'; end if;
  select name into category_name from public.expense_categories where id=p_category_id and active;
  if category_name is null then raise exception 'Categoria inválida'; end if;
  if p_recurring then
    insert into public.expense_recurrences(description,category_id,amount_cents,responsibility,professional_id,day_of_month,next_occurrence_date)
    values(trim(p_description),p_category_id,p_amount_cents,p_responsibility,case when p_responsibility='individual' then own_prof end,extract(day from p_launch_date)::integer,public.next_monthly_date(p_launch_date,extract(day from p_launch_date)::integer)) returning id into recurrence;
  end if;
  insert into public.expenses(description,category,category_id,amount_cents,competence_date,due_date,paid_at,responsibility,professional_id,payment_method,status,notes,recurrence_id,occurrence_date)
  values(trim(p_description),category_name,p_category_id,p_amount_cents,p_launch_date,p_launch_date,case when p_status='paid' then p_launch_date end,p_responsibility,case when p_responsibility='individual' then own_prof end,case when p_status='paid' then p_payment_method end,p_status,nullif(trim(p_notes),''),recurrence,case when p_recurring then p_launch_date end) returning id into new_id;
  return new_id;
end; $$;
revoke all on function public.register_expense(text,uuid,bigint,date,text,text,text,text,boolean) from public,anon;
grant execute on function public.register_expense(text,uuid,bigint,date,text,text,text,text,boolean) to authenticated;

create function public.materialize_expense_recurrences(p_through date) returns integer language plpgsql security invoker set search_path='' as $$
declare r record; generated integer:=0; category_name text; current_date_value date;
begin
  if not public.is_active_member() then return 0; end if;
  for r in select er.* from public.expense_recurrences er join public.expense_categories c on c.id=er.category_id and c.active where er.active and er.created_by=auth.uid() and er.next_occurrence_date<=p_through for update of er loop
    select name into category_name from public.expense_categories where id=r.category_id;
    current_date_value:=r.next_occurrence_date;
    while current_date_value<=p_through loop
      insert into public.expenses(description,category,category_id,amount_cents,competence_date,due_date,responsibility,professional_id,status,recurrence_id,occurrence_date)
      values(r.description,category_name,r.category_id,r.amount_cents,current_date_value,current_date_value,r.responsibility,r.professional_id,'pending',r.id,current_date_value)
      on conflict (recurrence_id,occurrence_date) where recurrence_id is not null do nothing;
      generated:=generated+1;
      current_date_value:=public.next_monthly_date(current_date_value,r.day_of_month);
    end loop;
    update public.expense_recurrences set next_occurrence_date=current_date_value where id=r.id;
  end loop;
  return generated;
end; $$;
revoke all on function public.materialize_expense_recurrences(date) from public,anon;
grant execute on function public.materialize_expense_recurrences(date) to authenticated;

create function public.update_expense_recurrence(p_id uuid,p_description text,p_category_id uuid,p_amount_cents bigint,p_responsibility text) returns void language plpgsql security invoker set search_path='' as $$
declare own_prof uuid;
begin
  own_prof:=public.own_professional_id();
  if not exists(select 1 from public.expense_categories where id=p_category_id and active) then raise exception 'Categoria inválida'; end if;
  update public.expense_recurrences set description=trim(p_description),category_id=p_category_id,amount_cents=p_amount_cents,responsibility=p_responsibility,professional_id=case when p_responsibility='individual' then own_prof end where id=p_id and created_by=auth.uid() and active;
  if not found then raise exception 'Recorrência não encontrada'; end if;
end; $$;
create function public.stop_expense_recurrence(p_id uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
  update public.expense_recurrences set active=false,stopped_at=now() where id=p_id and created_by=auth.uid() and active;
  if not found then raise exception 'Recorrência não encontrada'; end if;
end; $$;
revoke all on function public.update_expense_recurrence(uuid,text,uuid,bigint,text) from public,anon;
revoke all on function public.stop_expense_recurrence(uuid) from public,anon;
grant execute on function public.update_expense_recurrence(uuid,text,uuid,bigint,text) to authenticated;
grant execute on function public.stop_expense_recurrence(uuid) to authenticated;

alter function public.get_financial_dashboard(date,date) rename to get_financial_dashboard_before_recurrences;
create function public.get_financial_dashboard(p_start date,p_end date) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  perform public.materialize_expense_recurrences(p_end);
  result:=public.get_financial_dashboard_before_recurrences(p_start,p_end);
  return result || jsonb_build_object('expenseRecurrences',coalesce((select jsonb_agg(jsonb_build_object('id',er.id,'description',er.description,'categoryId',er.category_id,'amountCents',er.amount_cents,'responsibility',er.responsibility,'active',er.active,'nextOccurrenceDate',er.next_occurrence_date) order by er.description) from public.expense_recurrences er where er.created_by=auth.uid()),'[]'::jsonb));
end; $$;
revoke all on function public.get_financial_dashboard(date,date) from public,anon;
grant execute on function public.get_financial_dashboard(date,date) to authenticated;

commit;
