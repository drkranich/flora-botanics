alter table public.coupons
  add column if not exists stripe_coupon_id text,
  add column if not exists stripe_promotion_code_id text,
  add column if not exists stripe_environment text not null default 'test'
    check (stripe_environment in ('test','production')),
  add column if not exists stripe_sync_status text not null default 'not_linked'
    check (stripe_sync_status in ('not_linked','queued','synced','error','archived')),
  add column if not exists stripe_last_sync_at timestamptz,
  add column if not exists stripe_last_error text,
  add column if not exists stripe_metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_coupons_updated on public.coupons;
create trigger trg_coupons_updated before update on public.coupons
  for each row execute function public.set_updated_at();

create unique index if not exists coupons_stripe_coupon_env_unique
  on public.coupons(stripe_environment, stripe_coupon_id)
  where stripe_coupon_id is not null;

create unique index if not exists coupons_stripe_promotion_env_unique
  on public.coupons(stripe_environment, stripe_promotion_code_id)
  where stripe_promotion_code_id is not null;

create index if not exists idx_coupons_stripe_status
  on public.coupons(tenant_id, stripe_environment, stripe_sync_status, updated_at desc);
