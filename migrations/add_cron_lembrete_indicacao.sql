-- Push periódico convidando a indicar motoboy/loja nova — a cada 7 dias.
-- Agendado numa quarta-feira às 10h (dia-da-semana, não dia-do-mês) e num
-- horário diferente do lembrete-avaliacao-cron (9h, dia-do-mês múltiplo de
-- 3) de propósito — evita cair no mesmo horário na maioria das semanas.
-- Mesmo padrão de autenticação de todo o resto (Authorization: Bearer com
-- cron_dispatch_key do Vault, verificado pelo gateway do Supabase).
SELECT cron.schedule(
  'lembrete-indicacao-cron',
  '0 10 * * 3',
  $$
  select net.http_post(
    url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/lembrete-indicacao',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_dispatch_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
