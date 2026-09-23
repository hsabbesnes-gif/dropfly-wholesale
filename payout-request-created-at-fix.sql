-- Fix payout-request inserts for the live schema, which has requested_at but no created_at.
-- The notification trigger previously referenced NEW.created_at and rolled back requests.
create or replace function public.wholesale_event_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_business text;
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
      'طلب تسديد من '||coalesce(v_business,'نشاط تجاري')||E'\nالمبلغ المطلوب: '||coalesce(new.requested_amount,0)||' د.ع'||E'\nتاريخ الطلب: '||coalesce(new.requested_at,now())::text,
      'payout_request',new.id::text,false);
  elsif tg_table_name='wholesale_profiles' and tg_op='UPDATE' and new.status is distinct from old.status then
    insert into public.wholesale_notifications(sender_id,recipient_id,title,body,kind,entity_id,allow_reply)
    values(auth.uid(),new.id,'تحديث حالة الانضمام',case when new.status='approved' then 'تم قبول انضمامك ويمكنك الدخول الآن' else 'تم تحديث حالة حسابك إلى '||new.status end,'account_status',new.id::text,true);
  end if;
  return new;
end;
$$;
