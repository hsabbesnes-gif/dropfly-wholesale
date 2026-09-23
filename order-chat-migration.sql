-- Order-specific support conversations, using the existing support tables.
alter table public.wholesale_support_tickets
  add column if not exists order_id uuid references public.wholesale_orders(id) on delete cascade,
  add column if not exists expires_at timestamptz;

alter table public.wholesale_support_tickets enable row level security;
alter table public.wholesale_support_messages enable row level security;

create unique index if not exists wholesale_support_one_ticket_per_order
  on public.wholesale_support_tickets(order_id) where order_id is not null;

create or replace function public.wholesale_order_ticket_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_merchant uuid; v_number text;
begin
  if tg_op = 'UPDATE' then
    if (old.order_id is not null or new.order_id is not null) and (new.order_id is distinct from old.order_id or new.expires_at is distinct from old.expires_at or new.merchant_id is distinct from old.merchant_id) then
      raise exception 'Order conversation ownership and expiry cannot be changed';
    end if;
    return new;
  end if;
  if new.order_id is null then return new; end if;
  select merchant_id, order_number into v_merchant, v_number
    from public.wholesale_orders where id = new.order_id;
  if v_merchant is null then raise exception 'Order not found'; end if;
  if not public.wholesale_is_admin() and v_merchant <> auth.uid() then
    raise exception 'This order is not yours';
  end if;
  new.merchant_id := v_merchant;
  new.subject := 'ملاحظة على الطلب ' || v_number;
  new.expires_at := now() + interval '24 hours';
  return new;
end $$;

drop trigger if exists wholesale_order_ticket_guard_trigger on public.wholesale_support_tickets;
create trigger wholesale_order_ticket_guard_trigger
  before insert or update on public.wholesale_support_tickets
  for each row execute function public.wholesale_order_ticket_guard();

create or replace function public.wholesale_order_message_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_order_id uuid; v_expiry timestamptz; v_status text;
begin
  if tg_op = 'UPDATE' and (new.ticket_id is distinct from old.ticket_id or new.sender_id is distinct from old.sender_id) then
    raise exception 'Message owner and conversation cannot be changed';
  end if;
  select order_id, expires_at, status into v_order_id, v_expiry, v_status
    from public.wholesale_support_tickets where id = new.ticket_id;
  if v_order_id is not null then
    if v_expiry is null or now() >= v_expiry or v_status = 'closed' then
      raise exception 'This order conversation closed after 24 hours';
    end if;
    if new.body is null or length(trim(new.body)) = 0 or length(new.body) > 5000 then
      raise exception 'Message must contain 1 to 5000 characters';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists wholesale_order_message_guard_trigger on public.wholesale_support_messages;
create trigger wholesale_order_message_guard_trigger
  before insert or update on public.wholesale_support_messages
  for each row execute function public.wholesale_order_message_guard();
