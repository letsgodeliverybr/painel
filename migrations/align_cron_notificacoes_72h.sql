-- Alinha os 2 crons de notificação periódica (avaliar app + indicação) no
-- MESMO ciclo de 72h e troca a autenticação de Authorization: Bearer +
-- cron_dispatch_key (Vault) pra x-webhook-secret — necessário porque as
-- functions agora também são chamadas direto pelo painel (aba "Disparar
-- Notificações"), que usa esse mesmo header (ver comentário em
-- supabase/config.toml e nos index.ts das 2 functions).
--
-- cron.schedule com um jobname que já existe SUBSTITUI o job (mesmo
-- padrão já usado nas outras migrations deste projeto) — não cria
-- duplicado, não precisa de cron.unschedule antes.
--
-- lembrete-avaliacao-cron: já rodava '0 9 */3 * *' (dia-do-mês múltiplo de
-- 3, 9h) — mantém o mesmo horário/expressão, só troca o header de auth.
SELECT cron.schedule(
  'lembrete-avaliacao-cron',
  '0 9 */3 * *',
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

-- lembrete-indicacao-cron: antes rodava semanal (quarta 10h, '0 10 * * 3')
-- de propósito num horário diferente do lembrete-avaliacao pra não colidir
-- — decisão revertida a pedido do usuário: agora roda no MESMO ciclo
-- (dia-do-mês múltiplo de 3, 9h), lado a lado com o de avaliação. Rodar os
-- 2 no mesmo horário não duplica nem sobrepõe nada — são 2 jobs
-- independentes, cada um chama sua própria function/URL; o entregador só
-- recebe as 2 notificações (avaliar app + indicação) em sequência no
-- mesmo dia, o que é exatamente o pedido.
SELECT cron.schedule(
  'lembrete-indicacao-cron',
  '0 9 */3 * *',
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
