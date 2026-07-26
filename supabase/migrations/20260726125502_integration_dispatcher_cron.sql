-- ============================================================
-- FLORA ECOSYSTEM · Cron do dispatcher de integrações
-- Executa a Edge Function integration-dispatcher a cada 5 minutos.
-- Processa filas, eventos, retries e alertas da Central de Integrações.
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('integration-dispatcher');
exception when others then
  null;
end $$;

select cron.schedule(
  'integration-dispatcher',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://mbpvzhcrimdwcqkqvoqr.supabase.co/functions/v1/integration-dispatcher',
      body := '{}'::jsonb,
      params := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 30000
    ) as request_id;
  $$
);
