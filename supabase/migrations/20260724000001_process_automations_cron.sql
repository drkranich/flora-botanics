-- ============================================================
-- FLORA ECOSYSTEM · Migration 21: Cron para process-automations
-- Executa a Edge Function process-automations a cada 15 minutos.
-- Trata: order_paid, order_cancelled, birthday.
-- (Abandoned cart é tratado pelo cron cart-recovery separadamente.)
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('process-automations');
exception when others then
  null;
end $$;

select cron.schedule(
  'process-automations',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://mbpvzhcrimdwcqkqvoqr.supabase.co/functions/v1/process-automations',
      body := '{}'::jsonb,
      params := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 30000
    ) as request_id;
  $$
);
