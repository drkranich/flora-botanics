-- admins do tenant podem registrar auditoria (transições de pedido etc.)
create policy audit_staff_insert on public.audit_logs for insert
  with check (public.is_tenant_admin(tenant_id));
