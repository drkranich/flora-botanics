-- ============================================================
-- FLORA ECOSYSTEM · Migration 5: RLS em todas as tabelas
-- (aplicada em 2026-06-11 via MCP)
-- Padrões:
--   public_read  -> conteúdo publicado é legível por anon (site público)
--   staff_all    -> staff do tenant gerencia tudo do seu tenant
--   owner_read   -> cliente lê apenas o que é dele
--   Escrita de vendas -> APENAS service role (Edge Functions)
-- ============================================================

alter table public.tenants enable row level security;
create policy tenants_public_read on public.tenants for select
  using (status = 'active');
create policy tenants_admin_write on public.tenants for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

alter table public.tenant_domains enable row level security;
create policy domains_public_read on public.tenant_domains for select using (true);
create policy domains_admin_write on public.tenant_domains for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

alter table public.tenant_themes enable row level security;
create policy themes_public_read on public.tenant_themes for select using (true);
create policy themes_staff_write on public.tenant_themes for all
  using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

alter table public.profiles enable row level security;
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and role = 'customer');
create policy profiles_admin_all on public.profiles for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

alter table public.audit_logs enable row level security;
create policy audit_staff_read on public.audit_logs for select
  using (public.is_tenant_admin(tenant_id));

alter table public.media enable row level security;
create policy media_public_read on public.media for select using (true);
create policy media_staff_write on public.media for all
  using (public.is_tenant_staff(tenant_id)) with check (public.is_tenant_staff(tenant_id));

alter table public.categories enable row level security;
create policy categories_public_read on public.categories for select
  using (status = 'published' or public.is_tenant_staff(tenant_id));
create policy categories_staff_write on public.categories for all
  using (public.is_tenant_staff(tenant_id)) with check (public.is_tenant_staff(tenant_id));

alter table public.products enable row level security;
create policy products_public_read on public.products for select
  using ((status = 'published' and deleted_at is null) or public.is_tenant_staff(tenant_id));
create policy products_staff_write on public.products for all
  using (public.is_tenant_staff(tenant_id)) with check (public.is_tenant_staff(tenant_id));

alter table public.product_variants enable row level security;
create policy variants_public_read on public.product_variants for select
  using (exists (select 1 from public.products p where p.id = product_id
                 and ((p.status = 'published' and p.deleted_at is null)
                      or public.is_tenant_staff(p.tenant_id))));
create policy variants_staff_write on public.product_variants for all
  using (public.is_tenant_staff(tenant_id)) with check (public.is_tenant_staff(tenant_id));

alter table public.product_categories enable row level security;
create policy pc_public_read on public.product_categories for select using (true);
create policy pc_staff_write on public.product_categories for all
  using (exists (select 1 from public.products p where p.id = product_id
                 and public.is_tenant_staff(p.tenant_id)))
  with check (exists (select 1 from public.products p where p.id = product_id
                 and public.is_tenant_staff(p.tenant_id)));

alter table public.product_media enable row level security;
create policy pm_public_read on public.product_media for select using (true);
create policy pm_staff_write on public.product_media for all
  using (exists (select 1 from public.products p where p.id = product_id
                 and public.is_tenant_staff(p.tenant_id)))
  with check (exists (select 1 from public.products p where p.id = product_id
                 and public.is_tenant_staff(p.tenant_id)));

alter table public.collections enable row level security;
create policy collections_public_read on public.collections for select
  using (status = 'published' or public.is_tenant_staff(tenant_id));
create policy collections_staff_write on public.collections for all
  using (public.is_tenant_staff(tenant_id)) with check (public.is_tenant_staff(tenant_id));

alter table public.collection_products enable row level security;
create policy cp_public_read on public.collection_products for select using (true);
create policy cp_staff_write on public.collection_products for all
  using (exists (select 1 from public.collections c where c.id = collection_id
                 and public.is_tenant_staff(c.tenant_id)))
  with check (exists (select 1 from public.collections c where c.id = collection_id
                 and public.is_tenant_staff(c.tenant_id)));

alter table public.inventory enable row level security;
create policy inventory_public_read on public.inventory for select using (true);
create policy inventory_staff_write on public.inventory for all
  using (public.is_tenant_staff(tenant_id)) with check (public.is_tenant_staff(tenant_id));

alter table public.pages enable row level security;
create policy pages_public_read on public.pages for select
  using (status = 'published' or public.is_tenant_staff(tenant_id));
create policy pages_staff_write on public.pages for all
  using (public.is_tenant_staff(tenant_id)) with check (public.is_tenant_staff(tenant_id));

alter table public.page_versions enable row level security;
create policy pv_public_read on public.page_versions for select
  using (exists (select 1 from public.pages p where p.id = page_id
                 and (p.published_version_id = page_versions.id
                      or public.is_tenant_staff(p.tenant_id))));
create policy pv_staff_write on public.page_versions for all
  using (public.is_tenant_staff(tenant_id)) with check (public.is_tenant_staff(tenant_id));

alter table public.menus enable row level security;
create policy menus_public_read on public.menus for select using (true);
create policy menus_staff_write on public.menus for all
  using (public.is_tenant_staff(tenant_id)) with check (public.is_tenant_staff(tenant_id));

alter table public.site_settings enable row level security;
create policy settings_public_read on public.site_settings for select using (true);
create policy settings_staff_write on public.site_settings for all
  using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

alter table public.customers enable row level security;
create policy customers_owner_read on public.customers for select
  using (profile_id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy customers_owner_update on public.customers for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

alter table public.addresses enable row level security;
create policy addresses_owner_all on public.addresses for all
  using (exists (select 1 from public.customers c where c.id = customer_id
                 and (c.profile_id = auth.uid() or public.is_tenant_admin(c.tenant_id))))
  with check (exists (select 1 from public.customers c where c.id = customer_id
                 and c.profile_id = auth.uid()));

alter table public.carts enable row level security;
create policy carts_owner_read on public.carts for select
  using ((customer_id is not null and exists
           (select 1 from public.customers c where c.id = customer_id and c.profile_id = auth.uid()))
         or public.is_tenant_admin(tenant_id));

alter table public.cart_items enable row level security;
create policy cart_items_owner_read on public.cart_items for select
  using (exists (select 1 from public.carts ca
                 join public.customers c on c.id = ca.customer_id
                 where ca.id = cart_id and c.profile_id = auth.uid()));

alter table public.orders enable row level security;
create policy orders_owner_read on public.orders for select
  using ((customer_id is not null and exists
           (select 1 from public.customers c where c.id = customer_id and c.profile_id = auth.uid()))
         or public.is_tenant_admin(tenant_id));
create policy orders_staff_update on public.orders for update
  using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

alter table public.order_items enable row level security;
create policy order_items_owner_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id
                 and ((o.customer_id is not null and exists
                        (select 1 from public.customers c where c.id = o.customer_id
                         and c.profile_id = auth.uid()))
                      or public.is_tenant_admin(o.tenant_id))));

alter table public.payments enable row level security;
create policy payments_staff_read on public.payments for select
  using (public.is_tenant_admin(tenant_id));

alter table public.subscriptions enable row level security;
create policy subs_owner_read on public.subscriptions for select
  using (exists (select 1 from public.customers c where c.id = customer_id
                 and (c.profile_id = auth.uid() or public.is_tenant_admin(c.tenant_id))));

alter table public.shipments enable row level security;
create policy shipments_owner_read on public.shipments for select
  using (exists (select 1 from public.orders o where o.id = order_id
                 and ((o.customer_id is not null and exists
                        (select 1 from public.customers c where c.id = o.customer_id
                         and c.profile_id = auth.uid()))
                      or public.is_tenant_admin(o.tenant_id))));
create policy shipments_staff_write on public.shipments for all
  using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

alter table public.coupons enable row level security;
create policy coupons_staff_all on public.coupons for all
  using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

alter table public.leads enable row level security;
create policy leads_staff_read on public.leads for select
  using (public.is_tenant_admin(tenant_id));

alter table public.jobs enable row level security;
-- jobs: nenhuma política -> apenas service role acessa
