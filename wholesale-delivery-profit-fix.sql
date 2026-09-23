-- A second AFTER UPDATE trigger was writing an extra profit transaction with kind='profit'.
-- Keep the guarded, idempotent delivered_profit insert in wholesale_order_guard.
drop trigger if exists wholesale_order_profit on public.wholesale_orders;

-- Preserve the duplicate rows for audit, but remove their extra balance amount.
update public.wholesale_transactions as duplicate
   set amount = 0,
       title = coalesce(nullif(duplicate.title, ''), 'ربح الطلب') || ' — تم تصحيح سجل الربح المكرر'
 where duplicate.kind = 'profit'
   and duplicate.order_id is not null
   and duplicate.amount <> 0
   and exists (
     select 1
       from public.wholesale_transactions as canonical
      where canonical.order_id = duplicate.order_id
        and canonical.kind = 'delivered_profit'
   );
