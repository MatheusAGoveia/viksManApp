-- Keep a single SELECT policy while preserving staff-only catalog mutations.

drop policy if exists "Staff manage products" on public.products;

create policy "Staff insert products"
  on public.products for insert to authenticated
  with check ((select private.is_staff()));

create policy "Staff update products"
  on public.products for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "Staff delete products"
  on public.products for delete to authenticated
  using ((select private.is_staff()));
