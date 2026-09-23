-- Private web push subscriptions and durable, detailed activity notifications.
-- Safe to re-run. No existing notifications or transaction rows are removed.
create extension if not exists pg_net with schema extensions;

create table if not exists public.wholesale_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('admin','merchant')),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wholesale_push_subscriptions_user_role_idx
  on public.wholesale_push_subscriptions(user_id,recipient_role);
alter table public.wholesale_push_subscriptions enable row level security;
drop policy if exists wholesale_push_subscriptions_owner_select on public.wholesale_push_subscriptions;
drop policy if exists wholesale_push_subscriptions_owner_write on public.wholesale_push_subscriptions;
drop policy if exists wholesale_push_subscriptions_owner_delete on public.wholesale_push_subscriptions;
create policy wholesale_push_subscriptions_owner_select on public.wholesale_push_subscriptions
  for select to authenticated using(user_id=auth.uid() or (public.wholesale_is_admin() and recipient_role='admin'));
create policy wholesale_push_subscriptions_owner_write on public.wholesale_push_subscriptions
  for insert to authenticated with check (
    user_id=auth.uid() and ((recipient_role='merchant' and not public.wholesale_is_admin()) or (recipient_role='admin' and public.wholesale_is_admin()))
  );
create policy wholesale_push_subscriptions_owner_update on public.wholesale_push_subscriptions
  for update to authenticated using(user_id=auth.uid()) with check (
    user_id=auth.uid() and ((recipient_role='merchant' and not public.wholesale_is_admin()) or (recipient_role='admin' and public.wholesale_is_admin()))
  );
create policy wholesale_push_subscriptions_owner_delete on public.wholesale_push_subscriptions
  for delete to authenticated using(user_id=auth.uid() or public.wholesale_is_admin());
grant select,insert,update,delete on public.wholesale_push_subscriptions to authenticated;
grant all on public.wholesale_push_subscriptions to service_role;

-- An insert notification is the single event source for saved in-app notices and push.
create or replace function public.wholesale_send_notification_push()
returns trigger language plpgsql security definer set search_path=public,extensions,vault,net as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='dropfly_push_webhook_secret' limit 1;
  if v_secret is null or length(v_secret)<32 then return new; end if;
  perform net.http_post(
    url:='https://xyuwqccmqggoctprbhzb.supabase.co/functions/v1/notification-push',
    body:=jsonb_build_object('type','INSERT','table','wholesale_notifications','schema','public','record',to_jsonb(new)),
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'apikey','sb_publishable_RHnLnO4J-PdXnPhLQUHeXg_9vJjjzCx',
      'x-push-secret',v_secret
    ),
    timeout_milliseconds:=2000
  );
  return new;
end;
$$;
drop trigger if exists wholesale_notification_push_trigger on public.wholesale_notifications;
create trigger wholesale_notification_push_trigger after insert on public.wholesale_notifications
  for each row execute function public.wholesale_send_notification_push();

-- Enrich durable order and payout notices, while retaining the existing recipient scoping.
create or replace function public.wholesale_event_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_business text; v_order text; v_amount numeric;
begin
  if tg_table_name='wholesale_orders' and tg_op='INSERT' then
    insert into public.wholesale_notifications(sender_id,recipient_id,title,message,body,kind,entity_id,allow_reply)
    values(auth.uid(),new.merchant_id,'طلب جديد',new.order_number,
      'طلب جديد رقم '||coalesce(new.order_number,'—')||E'\nالزبون: '||coalesce(new.customer_name,'—')||E'\nالهاتف: '||coalesce(new.customer_phone,'—')||E'\nالمحافظة: '||coalesce(new.province,'—')||E'\nالمنطقة: '||coalesce(new.area,'—')||E'\nسعر البيع: '||coalesce(new.customer_price,0)||' د.ع'||case when nullif(new.note,'') is not null then E'\nملاحظة: '||left(new.note,300) else '' end,
      'new_order',new.id::text,false);
  elsif tg_table_name='wholesale_orders' and tg_op='UPDATE' and new.status is distinct from old.status then
    select coalesce(business_name,full_name,'نشاط تجاري') into v_business from public.wholesale_profiles where id=new.merchant_id;
    insert into public.wholesale_notifications(sender_id,recipient_role,title,body,kind,entity_id,allow_reply)
    values(auth.uid(),'admin','تحديث حالة طلب',coalesce(v_business,'نشاط تجاري')||' حدّث الطلب '||coalesce(new.order_number,'—')||' إلى حالة: '||new.status,'order_status',new.id::text,false);
  elsif tg_table_name='wholesale_payout_requests' and tg_op='INSERT' then
    select coalesce(business_name,full_name,'نشاط تجاري') into v_business from public.wholesale_profiles where id=new.merchant_id;
    insert into public.wholesale_notifications(sender_id,recipient_role,title,message,body,kind,entity_id,allow_reply)
    values(new.merchant_id,'admin','طلب تسديد جديد',coalesce(v_business,'نشاط تجاري'),
      'طلب تسديد من '||coalesce(v_business,'نشاط تجاري')||E'\nالمبلغ المطلوب: '||coalesce(new.requested_amount,0)||' د.ع'||E'\nتاريخ الطلب: '||coalesce(new.requested_at,new.created_at,now())::text,
      'payout_request',new.id::text,false);
  elsif tg_table_name='wholesale_profiles' and tg_op='UPDATE' and new.status is distinct from old.status then
    insert into public.wholesale_notifications(sender_id,recipient_id,title,body,kind,entity_id,allow_reply)
    values(auth.uid(),new.id,'تحديث حالة الانضمام',case when new.status='approved' then 'تم قبول انضمامك ويمكنك الدخول الآن' else 'تم تحديث حالة حسابك إلى '||new.status end,'account_status',new.id::text,true);
  end if;
  return new;
end;
$$;

create or replace function public.wholesale_complete_payout(p_request uuid, p_amount integer)
returns void language plpgsql security definer set search_path=public as $$
declare r public.wholesale_payout_requests; bal bigint; v_business text;
begin
  if not public.wholesale_is_admin() then raise exception 'غير مصرح'; end if;
  select * into r from public.wholesale_payout_requests where id=p_request for update;
  if r.id is null then raise exception 'طلب التسديد غير موجود'; end if;
  if r.status<>'pending' then raise exception 'تمت معالجة الطلب مسبقاً'; end if;
  bal:=public.wholesale_balance(r.merchant_id);
  if p_amount<=0 or p_amount>bal then raise exception 'مبلغ التسديد غير صالح'; end if;
  select coalesce(business_name,full_name,'نشاط تجاري') into v_business from public.wholesale_profiles where id=r.merchant_id;
  insert into public.wholesale_transactions(merchant_id,amount,kind,title,created_by)
    values(r.merchant_id,-p_amount,'payout','تم تسديد '||p_amount||' د.ع',auth.uid());
  update public.wholesale_payout_requests set paid_amount=p_amount,status='completed',processed_at=now() where id=p_request;
  insert into public.wholesale_notifications(sender_id,recipient_id,title,message,body,kind,entity_id,allow_reply)
    values(auth.uid(),r.merchant_id,'تم تسديد الحساب','تم سحب المبلغ من حسابك',
      'تمت معالجة طلب التسديد رقم '||r.id::text||E'\nالنشاط التجاري: '||coalesce(v_business,'نشاط تجاري')||E'\nالمبلغ المسحوب: '||p_amount||' د.ع'||E'\nتاريخ العملية: '||now()::text,
      'payout',p_request::text,false);
end;
$$;
revoke all on function public.wholesale_complete_payout(uuid,integer) from public;
grant execute on function public.wholesale_complete_payout(uuid,integer) to authenticated;

create or replace function public.wholesale_support_message_notify()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_merchant uuid; v_order uuid; v_number text; v_business text;
begin
  select t.merchant_id,t.order_id,o.order_number,p.business_name into v_merchant,v_order,v_number,v_business
    from public.wholesale_support_tickets t
    left join public.wholesale_orders o on o.id=t.order_id
    left join public.wholesale_profiles p on p.id=t.merchant_id
   where t.id=new.ticket_id;
  if v_merchant is null then return new; end if;
  if new.sender_id=v_merchant then
    update public.wholesale_support_tickets set last_merchant_reply_at=new.created_at where id=new.ticket_id;
    insert into public.wholesale_notifications(sender_id,recipient_role,title,message,body,kind,entity_id,allow_reply)
    values(new.sender_id,'admin','رسالة دعم جديدة',left(new.body,500),
      coalesce(v_business,'نشاط تجاري')||case when v_number is not null then ' • الطلب '||v_number else '' end||E'\n'||left(new.body,500),
      'support',coalesce(v_order::text,new.ticket_id::text),true);
  else
    update public.wholesale_support_tickets set last_admin_reply_at=new.created_at where id=new.ticket_id;
    insert into public.wholesale_notifications(sender_id,recipient_id,title,message,body,kind,entity_id,allow_reply)
    values(new.sender_id,v_merchant,'رد جديد من دعم دروب فلاي',left(new.body,500),
      case when v_number is not null then 'رد على الطلب '||v_number||E'\n' else '' end||left(new.body,500),
      'support',coalesce(v_order::text,new.ticket_id::text),true);
  end if;
  return new;
end;
$$;
drop trigger if exists wholesale_support_message_notify_trigger on public.wholesale_support_messages;
create trigger wholesale_support_message_notify_trigger after insert on public.wholesale_support_messages
  for each row execute function public.wholesale_support_message_notify();
