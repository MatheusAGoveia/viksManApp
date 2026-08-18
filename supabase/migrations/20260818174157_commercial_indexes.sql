create index appointment_payments_created_by_idx
  on public.appointment_payments (created_by) where created_by is not null;
create index promotions_created_by_idx
  on public.promotions (created_by);
create index promotion_deliveries_client_idx
  on public.promotion_deliveries (client_id);
