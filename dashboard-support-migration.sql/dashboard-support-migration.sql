-- Support inbox timestamps and merchant-to-admin notifications. Additive and safe to re-run.
alter table public.wholesale_support_tickets
  add column if not exists admin_opened_at timestamptz,
  add column if not exists last_admin_reply_at timestamptz,
  add column if not exists last_merchant_reply_at timestamptz;

create or replace function public.wholesale_mark_ticket_open(p_ticket_id uuid)
returns timestamptz
language plpgsql security definer set search_path=public
as $$
declare v_opened timestamptz;
begin
  if not public.wholesale_is_admin() then raise exception 'Admin access required'; end if;
  update public.wholesale_support_tickets
     set admin_opened_at=coalesce(admin_opened_at,now()),
         status=case when status='closed' or (expires_at is not null and expires_at<=now()) then 'closed' else 'in_progress' end
   where id=p_ticket_id
   returning admin_opened_at into v_opened;
  if v_opened is null then raise exception 'Support conversation not found'; end if;
  return v_opened;
end;
$$;
grant execute on function public.wholesale_mark_ticket_open(uuid) to authenticated;

create or replace function public.wholesale_support_message_notify()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_merchant uuid; v_order uuid;
begin
  select merchant_id,order_id into v_merchant,v_order
    from public.wholesale_support_tickets where id=new.ticket_id;
  if v_merchant is null then return new; end if;
  if new.sender_id=v_merchant then
    update public.wholesale_support_tickets set last_merchant_reply_at=new.created_at where id=new.ticket_id;
    insert into public.wholesale_notifications(sender_id,recipient_role,title,message,body,kind,entity_id,allow_reply)
    values(new.sender_id,'admin','رسالة دعم جديدة',left(new.body,500),left(new.body,500),'support',coalesce(v_order::text,new.ticket_id::text),true);
  else
    update public.wholesale_support_tickets set last_admin_reply_at=new.created_at where id=new.ticket_id;
    insert into public.wholesale_notifications(sender_id,recipient_id,title,message,body,kind,entity_id,allow_reply)
    values(new.sender_id,v_merchant,'رد جديد من دعم دروب فلاي',left(new.body,500),left(new.body,500),'support',coalesce(v_order::text,new.ticket_id::text),true);
  end if;
  return new;
end;
$$;
drop trigger if exists wholesale_support_message_notify_trigger on public.wholesale_support_messages;
create trigger wholesale_support_message_notify_trigger
  after insert on public.wholesale_support_messages
  for each row execute function public.wholesale_support_message_notify();

create or replace function public.wholesale_close_expired_support_tickets()
returns integer language plpgsql security definer set search_path=public
as $$
declare v_count integer;
begin
  update public.wholesale_support_tickets
     set status='closed', updated_at=now()
   where order_id is not null and expires_at<=now() and status<>'closed';
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function public.wholesale_close_expired_support_tickets() from public;

do $$
begin
  if not exists (select 1 from cron.job where jobname='dropfly-support-expire-24h') then
    perform cron.schedule('dropfly-support-expire-24h','*/5 * * * *',
      'select public.wholesale_close_expired_support_tickets();');
  end if;
end;
$$;
