-- Volta o od-eventos-cron ao padrão de 5 s (como está em od_etapa4_webhook.sql).
BEGIN;
SELECT cron.unschedule('od-eventos-cron');
SELECT cron.schedule('od-eventos-cron', '* * * * *', $cron$
  select net.http_post(
    url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/open-delivery/interno/eventos',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_dispatch_key')),
    body := '{}'::jsonb);
$cron$);
COMMIT;
