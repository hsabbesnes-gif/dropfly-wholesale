-- A second AFTER UPDATE trigger was writing an extra profit transaction with kind='profit'.
-- Keep the guarded, idempotent delivered_profit insert in wholesale_order_guard.
drop trigger if exists wholesale_order_profit on public.wholesale_orders;
