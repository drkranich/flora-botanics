-- ============================================================
-- FLORA ECOSYSTEM · Configuração de etiquetas de marketplaces
-- Define como cada tenant lida com etiquetas recebidas de canais
-- externos e quando deve gerar uma etiqueta própria da Flora.
-- ============================================================

create table if not exists public.marketplace_label_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_key text not null references public.integration_providers(key) on delete restrict,
  channel_account_id uuid references public.channel_accounts(id) on delete set null,
  status text not null default 'active'
    check (status in ('active','paused','archived')),
  source_preference text not null default 'external_then_flora'
    check (source_preference in (
      'external_label',
      'flora_label',
      'external_then_flora',
      'flora_then_external'
    )),
  external_label_formats jsonb not null default '["pdf","zpl","png"]'::jsonb,
  default_print_template text not null default 'shipping_100x150'
    check (default_print_template in (
      'shipping_100x150',
      'shipping_a4',
      'mixed_a4_sheet',
      'sku_50x30',
      'barcode_60x40',
      'barcode_100x50',
      'barcode_a4_2x7',
      'sku_a4_3x8',
      'kit_80x50'
    )),
  default_queue_format text not null default 'thermal'
    check (default_queue_format in ('a4','thermal','zpl','pdf')),
  tracking_source text not null default 'marketplace'
    check (tracking_source in ('marketplace','shipping_provider','flora','manual')),
  fallback_enabled boolean not null default true,
  auto_queue_external_label boolean not null default true,
  store_original_label boolean not null default true,
  reprint_original_enabled boolean not null default true,
  expected_payload jsonb not null default '{}'::jsonb,
  notes text,
  last_sync_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider_key)
);

create index if not exists idx_marketplace_label_settings_tenant_status
  on public.marketplace_label_settings(tenant_id, status, provider_key);

drop trigger if exists trg_marketplace_label_settings_updated on public.marketplace_label_settings;
create trigger trg_marketplace_label_settings_updated before update on public.marketplace_label_settings
  for each row execute function public.set_updated_at();

alter table public.marketplace_label_settings enable row level security;

drop policy if exists marketplace_label_settings_staff_read on public.marketplace_label_settings;
drop policy if exists marketplace_label_settings_admin_write on public.marketplace_label_settings;

create policy marketplace_label_settings_staff_read on public.marketplace_label_settings
  for select using (public.is_tenant_staff(tenant_id));

create policy marketplace_label_settings_admin_write on public.marketplace_label_settings
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

insert into public.marketplace_label_settings (
  tenant_id,
  provider_key,
  channel_account_id,
  status,
  source_preference,
  external_label_formats,
  default_print_template,
  default_queue_format,
  tracking_source,
  fallback_enabled,
  auto_queue_external_label,
  store_original_label,
  reprint_original_enabled
)
select
  t.id,
  p.key,
  ca.id,
  'active',
  'external_then_flora',
  '["pdf","zpl","png"]'::jsonb,
  case
    when p.key in ('mercado_livre','shopee','amazon') then 'shipping_100x150'
    else 'mixed_a4_sheet'
  end,
  case
    when p.key in ('mercado_livre','shopee','amazon') then 'thermal'
    else 'a4'
  end,
  'marketplace',
  true,
  true,
  true,
  true
from public.tenants t
join public.integration_providers p on p.category = 'marketplace' and p.is_active = true
left join public.channel_accounts ca on ca.tenant_id = t.id and ca.channel = p.key
where t.status = 'active'
on conflict (tenant_id, provider_key) do nothing;
