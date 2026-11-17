begin;

alter table public.receivables
  add column cancellation_reason text,
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references public.profiles(id) on delete restrict;
alter table public.expenses
  add column cancellation_reason text,
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references public.profiles(id) on delete restrict;

alter table public.receivables add constraint receivables_cancellation_audit check (
  status <> 'cancelled' or (
    cancelled_at is not null and cancelled_by is not null and
    length(trim(cancellation_reason)) between 3 and 300
  )
) not valid;
alter table public.expenses add constraint expenses_cancellation_audit check (
  status <> 'cancelled' or (
    cancelled_at is not null and cancelled_by is not null and
    length(trim(cancellation_reason)) between 3 and 300
  )
) not valid;

create function public.cancel_receivable(p_receivable_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid;
  current_status text;
begin
  if not public.is_active_member() then raise exception 'Usuária inativa'; end if;
  if length(trim(p_reason)) not between 3 and 300 then raise exception 'Justificativa inválida'; end if;
  select professional_id, status into owner_id, current_status
  from public.receivables where id = p_receivable_id for update;
  if not found then raise exception 'Receita não encontrada'; end if;
  if owner_id <> public.own_professional_id() then raise exception 'Cancelamento não autorizado'; end if;
  if current_status <> 'pending' or exists (select 1 from public.payments where receivable_id = p_receivable_id) then
    raise exception 'Receita com recebimento ou movimentação de caixa não pode ser cancelada';
  end if;
  update public.receivables set status = 'cancelled', cancellation_reason = trim(p_reason),
    cancelled_at = now(), cancelled_by = auth.uid() where id = p_receivable_id;
  return p_receivable_id;
end; $$;

create function public.cancel_expense(p_expense_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid;
  current_status text;
begin
  if not public.is_active_member() then raise exception 'Usuária inativa'; end if;
  if length(trim(p_reason)) not between 3 and 300 then raise exception 'Justificativa inválida'; end if;
  select created_by, status into owner_id, current_status
  from public.expenses where id = p_expense_id for update;
  if not found then raise exception 'Gasto não encontrado'; end if;
  if owner_id <> auth.uid() then raise exception 'Cancelamento não autorizado'; end if;
  if current_status not in ('planned', 'pending') then
    raise exception 'Gasto pago ou com movimentação de caixa não pode ser cancelado';
  end if;
  update public.expenses set status = 'cancelled', cancellation_reason = trim(p_reason),
    cancelled_at = now(), cancelled_by = auth.uid() where id = p_expense_id;
  return p_expense_id;
end; $$;

-- A quitação passa a ser a única via autorizada para alterar o estado de caixa do gasto.
create or replace function public.settle_expense(p_expense_id uuid, p_paid_at date, p_payment_method text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; current_status text;
begin
  if not public.is_active_member() then raise exception 'Usuária inativa'; end if;
  if p_expense_id is null or p_paid_at is null or p_payment_method is null then raise exception 'Dados do pagamento incompletos'; end if;
  select created_by, status into owner_id, current_status from public.expenses where id = p_expense_id for update;
  if not found then raise exception 'Conta a pagar não encontrada'; end if;
  if owner_id <> auth.uid() then raise exception 'Quitação não autorizada'; end if;
  if current_status not in ('planned', 'pending') then raise exception 'A conta não está em aberto ou já foi paga'; end if;
  update public.expenses set status = 'paid', paid_at = p_paid_at, payment_method = p_payment_method where id = p_expense_id;
  return p_expense_id;
end; $$;

revoke update (status) on public.receivables from authenticated;
revoke update (status, paid_at, payment_method) on public.expenses from authenticated;
revoke all on function public.cancel_receivable(uuid, text) from public, anon;
revoke all on function public.cancel_expense(uuid, text) from public, anon;
grant execute on function public.cancel_receivable(uuid, text) to authenticated;
grant execute on function public.cancel_expense(uuid, text) to authenticated;

commit;
