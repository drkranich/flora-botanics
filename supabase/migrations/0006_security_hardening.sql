-- ============================================================
-- FLORA ECOSYSTEM · Migration 6: Hardening (advisors)
-- (aplicada em 2026-06-11 via MCP)
-- ============================================================

alter function public.auth_tenant_id() set search_path = public;
alter function public.auth_role() set search_path = public;
alter function public.is_platform_admin() set search_path = public;
alter function public.is_tenant_staff(uuid) set search_path = public;
alter function public.is_tenant_admin(uuid) set search_path = public;
alter function public.set_updated_at() set search_path = public;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.next_order_number(uuid) from anon, authenticated, public;
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
