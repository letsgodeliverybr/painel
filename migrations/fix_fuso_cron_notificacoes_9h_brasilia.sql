-- align_cron_notificacoes_72h.sql deixou os 2 crons de notificação em
-- '0 9 */3 * *' assumindo "9h" = horário de Brasília — mas o banco roda em
-- UTC (confirmado: select current_setting('TimeZone') -> 'UTC'), então na
-- prática disparava 09:00 UTC = 06h da manhã em Brasília (UTC-3, sem
-- horário de verão desde 2019). Cedo demais pra notificação de motoboy.
--
-- Corrige pra '0 12 */3 * *' (12:00 UTC = 09:00 Brasília de verdade).
-- Mesmo dia-do-mês múltiplo de 3, só muda a hora. cron.schedule com
-- jobname existente substitui o job (mesmo padrão das outras migrations
-- deste projeto).
SELECT cron.schedule(
  'lembrete-avaliacao-cron',
  '0 12 */3 * *',
  $$
  select net.http_post(
    url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/lembrete-avaliacao',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'letsgo2026secret'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'lembrete-indicacao-cron',
  '0 12 */3 * *',
  $$
  select net.http_post(
    url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/lembrete-indicacao',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'letsgo2026secret'
    ),
    body := '{}'::jsonb
  );
  $$
);
