begin;

create index expense_recurrences_due_idx on public.expense_recurrences(created_by,next_occurrence_date) where active;
create index receivables_owner_open_due_idx on public.receivables(professional_id,due_date) where status in ('pending','partially_paid');
create index expenses_creator_open_due_idx on public.expenses(created_by,due_date) where status in ('planned','pending');

commit;
