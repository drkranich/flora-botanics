-- ============================================================
-- FLORA ECOSYSTEM · Migration 18: Acesso de leitura para tenant_editor
-- Corrige o gap em que tenant_editor conseguia logar no admin mas
-- via tudo vazio (policies usavam is_tenant_admin, que exclui editor).
--
-- Modelo: tenant_editor (e demais staff) ganham SELECT via
-- is_tenant_staff() nas tabelas de CRM/ERP. INSERT/UPDATE/DELETE
-- continuam restritos a is_tenant_admin() (owner/admin/platform_admin).
-- ============================================================

-- customers: leitura própria (cliente) OU staff do tenant (inclui editor)
alter policy customers_owner_read on public.customers
  using (profile_id = auth.uid() or public.is_tenant_staff(tenant_id));

-- orders: leitura própria (cliente) OU staff do tenant
alter policy orders_owner_read on public.orders
  using (
    (
      customer_id is not null
      and exists (
        select 1 from public.customers c
        where c.id = orders.customer_id and c.profile_id = auth.uid()
      )
    )
    or public.is_tenant_staff(tenant_id)
  );

-- order_items: segue a regra de orders
alter policy order_items_owner_read on public.order_items
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          (
            o.customer_id is not null
            and exists (
              select 1 from public.customers c
              where c.id = o.customer_id and c.profile_id = auth.uid()
            )
          )
          or public.is_tenant_staff(o.tenant_id)
        )
    )
  );

-- channel_accounts: leitura para staff (escrita/settings continua staff_settings = is_tenant_admin)
alter policy channels_staff_read on public.channel_accounts
  using (public.is_tenant_staff(tenant_id));

-- automation_runs: leitura para staff
alter policy automation_runs_staff_read on public.automation_runs
  using (public.is_tenant_staff(tenant_id));

-- system_logs: leitura para staff (resolver/reabrir continua staff_update = is_tenant_admin)
alter policy system_logs_staff_read on public.system_logs
  using (public.is_tenant_staff(tenant_id));

-- fiscal_configs: leitura para staff, escrita só is_tenant_admin
drop policy fiscal_configs_staff_all on public.fiscal_configs;
create policy fiscal_configs_staff_read on public.fiscal_configs
  for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_configs_admin_write on public.fiscal_configs
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- nfe_documents: leitura para staff, escrita só is_tenant_admin
drop policy nfe_documents_staff_all on public.nfe_documents;
create policy nfe_documents_staff_read on public.nfe_documents
  for select using (public.is_tenant_staff(tenant_id));
create policy nfe_documents_admin_write on public.nfe_documents
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- marketplace_listings: leitura para staff, escrita só is_tenant_admin
drop policy marketplace_listings_staff_all on public.marketplace_listings;
create policy marketplace_listings_staff_read on public.marketplace_listings
  for select using (public.is_tenant_staff(tenant_id));
create policy marketplace_listings_admin_write on public.marketplace_listings
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- message_templates: leitura para staff, escrita só is_tenant_admin
drop policy message_templates_staff_all on public.message_templates;
create policy message_templates_staff_read on public.message_templates
  for select using (public.is_tenant_staff(tenant_id));
create policy message_templates_admin_write on public.message_templates
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- automations: leitura para staff, escrita só is_tenant_admin
drop policy automations_staff_all on public.automations;
create policy automations_staff_read on public.automations
  for select using (public.is_tenant_staff(tenant_id));
create policy automations_admin_write on public.automations
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));
