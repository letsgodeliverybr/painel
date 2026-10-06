-- Agendamento od-eventos-cron: espera até 60 s pela resposta (antes: padrão
-- de 5 s do pg_net). PROPOSTA 2026-10-06, NÃO APLICADA.
-- Rollback: rollback_od_eventos_cron_timeout.sql
BEGIN;
SELECT cron.unschedule('od-eventos-cron');
SELECT cron.schedule('od-eventos-cron', '* * * * *', $cron$
  select net.http_post(
    url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/open-delivery/interno/eventos',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_dispatch_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$cron$);
COMMIT;
