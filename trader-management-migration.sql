-- Apply in the Supabase SQL editor. Requires the existing wholesale_profiles table.
create table if not exists public.wholesale_block_appeals (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (merchant_id)
);
create table if not exists public.wholesale_block_appeal_messages (
  id uuid primary key default gen_random_uuid(),
  appeal_id uuid not null references public.wholesale_block_appeals(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists wholesale_block_appeal_messages_order on public.wholesale_block_appeal_messages(appeal_id,created_at);

alter table public.wholesale_block_appeals enable row level security;
alter table public.wholesale_block_appeal_messages enable row level security;
drop policy if exists "appeal participants read" on public.wholesale_block_appeals;
create policy "appeal participants read" on public.wholesale_block_appeals for select to authenticated
using (merchant_id=auth.uid() or public.dropfly_profile_admin());
drop policy if exists "blocked merchant opens appeal" on public.wholesale_block_appeals;
create policy "blocked merchant opens appeal" on public.wholesale_block_appeals for insert to authenticated
with check (merchant_id=auth.uid() and exists (
  select 1 from public.wholesale_profiles where id=auth.uid() and status='blocked'
));
drop policy if exists "appeal participants read messages" on public.wholesale_block_appeal_messages;
create policy "appeal participants read messages" on public.wholesale_block_appeal_messages for select to authenticated
using (exists (select 1 from public.wholesale_block_appeals a where a.id=appeal_id and (a.merchant_id=auth.uid() or public.dropfly_profile_admin())));
drop policy if exists "appeal participants send messages" on public.wholesale_block_appeal_messages;
create policy "appeal participants send messages" on public.wholesale_block_appeal_messages for insert to authenticated
with check (sender_id=auth.uid() and exists (
  select 1 from public.wholesale_block_appeals a where a.id=appeal_id and
  (public.dropfly_profile_admin() or (a.merchant_id=auth.uid() and exists (
    select 1 from public.wholesale_profiles p where p.id=auth.uid() and p.status='blocked'
  )))
));
grant select,insert on public.wholesale_block_appeals, public.wholesale_block_appeal_messages to authenticated;

-- Management actions run with the database owner's privileges, but always check
-- the authenticated caller. A failed delete rolls back completely.
create or replace function public.dropfly_manage_trader(p_merchant_id uuid,p_action text)
returns void language plpgsql security definer set search_path=public,auth as $$
declare v_role text;
begin
  if not public.dropfly_profile_admin() then raise exception 'Admin access required'; end if;
  if p_merchant_id=auth.uid() then raise exception 'Cannot manage your own account'; end if;
  select role into v_role from public.wholesale_profiles where id=p_merchant_id for update;
  if not found or v_role='admin' then raise exception 'Merchant account not found'; end if;
  if p_action='block' then
    update public.wholesale_profiles set status='blocked' where id=p_merchant_id;
  elsif p_action='unblock' then
    update public.wholesale_profiles set status='approved' where id=p_merchant_id and status='blocked';
    if not found then raise exception 'Account is not blocked'; end if;
  elsif p_action='delete' then
    -- Do not leave a login account behind. FK violations abort this transaction.
    delete from auth.users where id=p_merchant_id;
    if not found then raise exception 'Authentication account not found'; end if;
    delete from public.wholesale_profiles where id=p_merchant_id;
  else
    raise exception 'Invalid action';
  end if;
end $$;
revoke all on function public.dropfly_manage_trader(uuid,text) from public;
grant execute on function public.dropfly_manage_trader(uuid,text) to authenticated;

create or replace function public.dropfly_admin_edit_trader(p_merchant_id uuid,p_changes jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_key text;
begin
  if not public.dropfly_profile_admin() then raise exception 'Admin access required'; end if;
  if p_merchant_id=auth.uid() or not exists(select 1 from public.wholesale_profiles where id=p_merchant_id and role<>'admin') then
    raise exception 'Merchant account not found';
  end if;
  if jsonb_typeof(p_changes)<>'object' then raise exception 'Invalid changes'; end if;
  for v_key in select jsonb_object_keys(p_changes) loop
    if v_key not in ('full_name','business_name','business_symbol','phone','business_phone') then
      raise exception 'Field is not editable';
    end if;
  end loop;
  if (p_changes ? 'phone' and (p_changes->>'phone') !~ '^07[0-9]{9}$') or
     (p_changes ? 'business_phone' and (p_changes->>'business_phone') !~ '^07[0-9]{9}$') then
    raise exception 'Invalid Iraqi phone number';
  end if;
  if exists(select 1 from jsonb_each_text(p_changes) x where length(x.value)>80 or (x.key in ('full_name','business_name') and trim(x.value)='')) then
    raise exception 'Invalid profile value';
  end if;
  update public.wholesale_profiles set
    full_name=coalesce(p_changes->>'full_name',full_name),
    business_name=coalesce(p_changes->>'business_name',business_name),
    business_symbol=coalesce(p_changes->>'business_symbol',business_symbol),
    phone=coalesce(p_changes->>'phone',phone),
    business_phone=coalesce(p_changes->>'business_phone',business_phone)
  where id=p_merchant_id;
end $$;
revoke all on function public.dropfly_admin_edit_trader(uuid,jsonb) from public;
grant execute on function public.dropfly_admin_edit_trader(uuid,jsonb) to authenticated;

-- Existing business policies remain in force; these restrictive policies make
-- every approved merchant check mandatory, even when an older policy permits uid.
do $$ declare t text; begin
  foreach t in array array[
    'wholesale_orders','wholesale_transactions','wholesale_payout_requests',
    'wholesale_support_tickets','wholesale_support_messages',
    'wholesale_profile_change_requests','wholesale_push_subscriptions'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists "blocked traders cannot use business data" on public.%I',t);
      execute format('create policy "blocked traders cannot use business data" on public.%I as restrictive for all to authenticated using (public.dropfly_profile_admin() or exists (select 1 from public.wholesale_profiles p where p.id=auth.uid() and p.status=''approved'')) with check (public.dropfly_profile_admin() or exists (select 1 from public.wholesale_profiles p where p.id=auth.uid() and p.status=''approved''))',t);
    end if;
  end loop;
end $$;
