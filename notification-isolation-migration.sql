-- Give every signed-in user access only to notifications addressed to that account.
-- Dashboard notices are addressed to the admin role and remain hidden from merchants.
alter table public.wholesale_notifications enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname
      from pg_policies
     where schemaname = 'public'
       and tablename = 'wholesale_notifications'
  loop
    execute format('drop policy if exists %I on public.wholesale_notifications', p.policyname);
  end loop;
end;
$$;

create policy wholesale_notifications_private_select
  on public.wholesale_notifications
  for select to authenticated
  using (
    recipient_id = auth.uid()
    or user_id = auth.uid()
    or (public.wholesale_is_admin() and recipient_role = 'admin')
  );

create policy wholesale_notifications_private_insert
  on public.wholesale_notifications
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.wholesale_is_admin()
  );

create policy wholesale_notifications_private_update
  on public.wholesale_notifications
  for update to authenticated
  using (
    recipient_id = auth.uid()
    or user_id = auth.uid()
    or (public.wholesale_is_admin() and recipient_role = 'admin')
  )
  with check (
    recipient_id = auth.uid()
    or user_id = auth.uid()
    or (public.wholesale_is_admin() and recipient_role = 'admin')
  );

create policy wholesale_notifications_private_delete
  on public.wholesale_notifications
  for delete to authenticated
  using (public.wholesale_is_admin());
