begin;

-- Reaplica as duas operações de uma conta aberta como SECURITY DEFINER.
-- Isso corrige ambientes em que a revogação de UPDATE foi aplicada antes
-- da substituição da versão antiga (SECURITY INVOKER) destas funções.
create or replace function public.settle_expense(
  p_expense_id uuid,
  p_paid_at date,
  p_payment_method text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  current_status text;
begin
  if not public.is_active_member() then raise exception 'Usuária inativa'; end if;
  if p_expense_id is null or p_paid_at is null or p_payment_method is null then
    raise exception 'Dados do pagamento incompletos';
  end if;
  if p_payment_method not in ('pix', 'cash', 'debit_card', 'credit_card', 'transfer', 'other') then
    raise exception 'Forma de pagamento inválida';
  end if;

  select e.created_by, e.status into owner_id, current_status
  from public.expenses e where e.id = p_expense_id for update;

  if not found then raise exception 'Conta a pagar não encontrada'; end if;
  if owner_id <> auth.uid() then raise exception 'Quitação não autorizada'; end if;
  if current_status not in ('planned', 'pending') then
    raise exception 'A conta não está em aberto ou já foi paga';
  end if;

  update public.expenses
  set status = 'paid', paid_at = p_paid_at, payment_method = p_payment_method,
      updated_by = auth.uid(), updated_at = now()
  where id = p_expense_id;

  return p_expense_id;
end;
$$;

create or replace function public.cancel_expense(
  p_expense_id uuid,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  current_status text;
begin
  if not public.is_active_member() then raise exception 'Usuária inativa'; end if;
  if length(trim(p_reason)) not between 3 and 300 then raise exception 'Justificativa inválida'; end if;

  select e.created_by, e.status into owner_id, current_status
  from public.expenses e where e.id = p_expense_id for update;

  if not found then raise exception 'Gasto não encontrado'; end if;
  if owner_id <> auth.uid() then raise exception 'Cancelamento não autorizado'; end if;
  if current_status not in ('planned', 'pending') then
    raise exception 'Gasto pago ou com movimentação de caixa não pode ser cancelado';
  end if;

  update public.expenses
  set status = 'cancelled', cancellation_reason = trim(p_reason),
      cancelled_at = now(), cancelled_by = auth.uid(),
      updated_by = auth.uid(), updated_at = now()
  where id = p_expense_id;

  return p_expense_id;
end;
$$;

revoke all on function public.settle_expense(uuid, date, text) from public, anon;
revoke all on function public.cancel_expense(uuid, text) from public, anon;
grant execute on function public.settle_expense(uuid, date, text) to authenticated;
grant execute on function public.cancel_expense(uuid, text) to authenticated;

commit;
