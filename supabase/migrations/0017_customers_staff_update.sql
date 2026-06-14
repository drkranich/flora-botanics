-- ============================================================
-- FLORA ECOSYSTEM · Migration 17: staff pode editar CRM do cliente
-- A policy 0005 (customers_owner_update) só permitia o próprio
-- cliente editar seu registro. O painel admin (Seção 14) precisa
-- editar aniversário/whatsapp/notas/tags em nome do tenant.
-- ============================================================

create policy customers_staff_update on public.customers for update
  using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
