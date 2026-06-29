-- ============================================================
-- FLORA ECOSYSTEM · Migration 20: Cron de Recuperação de Carrinho
-- Executa a Edge Function cart-recovery a cada 30 minutos.
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('cart-recovery');
exception when others then
  null;
end $$;

select cron.schedule(
  'cart-recovery',
  '*/30 * * * *',
  $$
    select net.http_post(
      url := 'https://mbpvzhcrimdwcqkqvoqr.supabase.co/functions/v1/cart-recovery',
      body := '{}'::jsonb,
      params := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 30000
    ) as request_id;
  $$
);
