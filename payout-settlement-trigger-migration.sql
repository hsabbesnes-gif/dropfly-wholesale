-- Settle payouts once, update the merchant's ledger, and save a private notice.
-- Safe to re-run; existing transactions are preserved.
alter table public.wholesale_transactions
  add column if not exists payout_request_id uuid references public.wholesale_payout_requests(id) on delete set null;
create unique index if not exists wholesale_transactions_payout_request_unique
  on public.wholesale_transactions(payout_request_id)
  where payout_request_id is not null;

create or replace function public.wholesale_payout_settlement_after_update()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_amount integer; v_business text; v_tx uuid;
begin
  if old.status is distinct from 'completed' and new.status='completed' then
    if not public.wholesale_is_admin() then raise exception 'غير مصرح'; end if;
    v_amount:=coalesce(nullif(new.paid_amount,0),new.requested_amount);
    if v_amount is null or v_amount<=0 or v_amount>public.wholesale_balance(new.merchant_id) then
      raise exception 'مبلغ التسديد غير صالح أو يتجاوز الرصيد';
    end if;
    select coalesce(business_name,full_name,'نشاط تجاري') into v_business
      from public.wholesale_profiles where id=new.merchant_id;
    insert into public.wholesale_transactions(merchant_id,payout_request_id,amount,kind,title,created_by)
      values(new.merchant_id,new.id,-v_amount,'payout','تم تسديد '||v_amount||' د.ع',auth.uid())
      on conflict (payout_request_id) where payout_request_id is not null do nothing
      returning id into v_tx;
    if v_tx is not null then
      insert into public.wholesale_notifications(sender_id,recipient_id,title,message,body,kind,entity_id,allow_reply)
      values(auth.uid(),new.merchant_id,'تم تسديد الحساب','تم سحب المبلغ من حسابك',
        'تمت معالجة طلب التسديد رقم '||new.id::text||E'\nالنشاط التجاري: '||coalesce(v_business,'نشاط تجاري')||E'\nالمبلغ المسحوب: '||v_amount||' د.ع'||E'\nتاريخ العملية: '||coalesce(new.processed_at,now())::text,
        'payout',new.id::text,false);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists wholesale_payout_settlement_after_update_trigger on public.wholesale_payout_requests;
create trigger wholesale_payout_settlement_after_update_trigger
  after update of status on public.wholesale_payout_requests
  for each row execute function public.wholesale_payout_settlement_after_update();

-- The trigger owns the ledger write so dashboard edits and RPC callers behave identically.
create or replace function public.wholesale_complete_payout(p_request uuid, p_amount integer)
returns void language plpgsql security definer set search_path=public as $$
declare r public.wholesale_payout_requests;
begin
  if not public.wholesale_is_admin() then raise exception 'غير مصرح'; end if;
  select * into r from public.wholesale_payout_requests where id=p_request for update;
  if r.id is null then raise exception 'طلب التسديد غير موجود'; end if;
  if r.status<>'pending' then raise exception 'تمت معالجة الطلب مسبقاً'; end if;
  if p_amount<=0 or p_amount>public.wholesale_balance(r.merchant_id) then raise exception 'مبلغ التسديد غير صالح'; end if;
  update public.wholesale_payout_requests
     set paid_amount=p_amount,status='completed',processed_at=now()
   where id=p_request;
end;
$$;
revoke all on function public.wholesale_complete_payout(uuid,integer) from public;
grant execute on function public.wholesale_complete_payout(uuid,integer) to authenticated;
