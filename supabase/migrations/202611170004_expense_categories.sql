begin;

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index expense_categories_name_idx on public.expense_categories(lower(trim(name)));

insert into public.expense_categories(name,created_by,updated_by)
select min(trim(category)),(min(created_by::text))::uuid,(min(created_by::text))::uuid
from public.expenses group by lower(trim(category));

alter table public.expenses add column category_id uuid references public.expense_categories(id) on delete restrict;
alter table public.expenses disable trigger expenses_audit_fields;
alter table public.expenses disable trigger expenses_audit;
update public.expenses e set category_id=c.id from public.expense_categories c where lower(trim(c.name))=lower(trim(e.category));
alter table public.expenses enable trigger expenses_audit_fields;
alter table public.expenses enable trigger expenses_audit;
alter table public.expenses alter column category_id set not null;

create function public.resolve_expense_category() returns trigger language plpgsql security definer set search_path='' as $$
declare resolved_id uuid;
resolved_name text;
resolved_active boolean;
begin
  if new.category_id is not null then
    select id,name,active into resolved_id,resolved_name,resolved_active from public.expense_categories where id=new.category_id;
    if resolved_id is null or not resolved_active then raise exception 'expense category is inactive or missing'; end if;
    new.category=resolved_name;
    return new;
  end if;
  select id,name,active into resolved_id,resolved_name,resolved_active from public.expense_categories where lower(trim(name))=lower(trim(new.category)) limit 1;
  if resolved_id is not null and not resolved_active then raise exception 'expense category is inactive'; end if;
  if resolved_id is null then
    insert into public.expense_categories(name,created_by,updated_by) values(trim(new.category),auth.uid(),auth.uid()) returning id,name into resolved_id,resolved_name;
  end if;
  new.category_id=resolved_id;
  new.category=resolved_name;
  return new;
end; $$;
revoke all on function public.resolve_expense_category() from public;
create trigger expenses_resolve_category before insert or update of category,category_id on public.expenses for each row execute function public.resolve_expense_category();

alter table public.expense_categories enable row level security;
revoke all on public.expense_categories from anon,authenticated;
grant select,insert(name),update(name,active) on public.expense_categories to authenticated;
grant insert(category_id),update(category_id) on public.expenses to authenticated;
create policy expense_categories_read on public.expense_categories for select to authenticated using ((select public.is_active_member()));
create policy expense_categories_insert on public.expense_categories for insert to authenticated with check ((select public.is_active_member()));
create policy expense_categories_update on public.expense_categories for update to authenticated using ((select public.is_active_member())) with check ((select public.is_active_member()));
create trigger expense_categories_audit_fields before insert or update on public.expense_categories for each row execute function public.set_financial_audit_fields();
create trigger expense_categories_audit after insert or update or delete on public.expense_categories for each row execute function public.audit_change();

alter function public.get_financial_dashboard(date,date) rename to get_financial_dashboard_before_categories;
create function public.get_financial_dashboard(p_start date,p_end date) returns jsonb language sql stable security invoker set search_path='' as $$
  select public.get_financial_dashboard_before_categories(p_start,p_end) || jsonb_build_object(
    'expenseCategories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'active',active) order by name) from public.expense_categories),'[]'::jsonb)
  );
$$;
revoke all on function public.get_financial_dashboard(date,date) from public,anon;
grant execute on function public.get_financial_dashboard(date,date) to authenticated;

commit;
