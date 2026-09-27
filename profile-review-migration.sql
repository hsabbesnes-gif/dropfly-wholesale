-- Run once in the Supabase SQL editor before enabling profile review in production.
alter table public.wholesale_profiles
  add column if not exists avatar_url text,
  add column if not exists business_symbol text;

create table if not exists public.wholesale_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.wholesale_profiles(id) on delete cascade,
  changes jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint wholesale_profile_changes_object check (jsonb_typeof(changes) = 'object')
);
create unique index if not exists wholesale_profile_one_pending
  on public.wholesale_profile_change_requests(merchant_id) where status = 'pending';
create index if not exists wholesale_profile_review_order
  on public.wholesale_profile_change_requests(status, created_at desc);

alter table public.wholesale_profile_change_requests enable row level security;
create or replace function public.dropfly_profile_admin() returns boolean
language sql security definer set search_path = public
as $$ select exists (select 1 from public.wholesale_profiles where id = auth.uid() and role = 'admin' and status = 'approved') $$;
revoke all on function public.dropfly_profile_admin() from public;
grant execute on function public.dropfly_profile_admin() to authenticated;

drop policy if exists "profile requests visible to owner and admin" on public.wholesale_profile_change_requests;
create policy "profile requests visible to owner and admin" on public.wholesale_profile_change_requests
for select to authenticated using (merchant_id = auth.uid() or public.dropfly_profile_admin());
drop policy if exists "owner submits profile request" on public.wholesale_profile_change_requests;
create policy "owner submits profile request" on public.wholesale_profile_change_requests
for insert to authenticated with check (
  merchant_id = auth.uid() and status = 'pending' and reviewed_by is null
  and changes ?| array['full_name','business_name','phone','business_phone','business_symbol']
  and not exists (select 1 from jsonb_object_keys(changes) as key
                  where key not in ('full_name','business_name','phone','business_phone','business_symbol'))
);
revoke update, delete on public.wholesale_profile_change_requests from authenticated;
grant select, insert on public.wholesale_profile_change_requests to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wholesale-avatars', 'wholesale-avatars', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "owner uploads avatar" on storage.objects;
create policy "owner uploads avatar" on storage.objects for insert to authenticated
with check (bucket_id = 'wholesale-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "owner reads avatar" on storage.objects;
create policy "owner reads avatar" on storage.objects for select to authenticated
using (bucket_id = 'wholesale-avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.dropfly_profile_admin()));

create or replace function public.dropfly_set_avatar(p_url text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or p_url not like auth.uid()::text || '/%'
     or length(p_url) > 500 then raise exception 'Invalid avatar URL'; end if;
  update public.wholesale_profiles set avatar_url = p_url where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
end $$;
revoke all on function public.dropfly_set_avatar(text) from public;
grant execute on function public.dropfly_set_avatar(text) to authenticated;

create or replace function public.dropfly_review_profile_request(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_request public.wholesale_profile_change_requests%rowtype;
begin
  if not public.dropfly_profile_admin() then raise exception 'Admin access required'; end if;
  select * into v_request from public.wholesale_profile_change_requests
    where id = p_id and status = 'pending' for update;
  if not found then raise exception 'Request already reviewed or missing'; end if;
  if p_approve then
    update public.wholesale_profiles set
      full_name = coalesce(v_request.changes->>'full_name', full_name),
      business_name = coalesce(v_request.changes->>'business_name', business_name),
      phone = coalesce(v_request.changes->>'phone', phone),
      business_phone = coalesce(v_request.changes->>'business_phone', business_phone),
      business_symbol = coalesce(v_request.changes->>'business_symbol', business_symbol)
    where id = v_request.merchant_id;
  end if;
  update public.wholesale_profile_change_requests
    set status = case when p_approve then 'approved' else 'rejected' end,
        review_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id;
end $$;
revoke all on function public.dropfly_review_profile_request(uuid, boolean, text) from public;
grant execute on function public.dropfly_review_profile_request(uuid, boolean, text) to authenticated;
