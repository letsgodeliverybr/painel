-- Push periódico pedindo pro entregador avaliar o app na Play Store —
-- mesmo padrão de autenticação já usado por despacho-engine-cron/
-- ifood-polling-cron/ifood-status-sync-cron (Authorization: Bearer com
-- cron_dispatch_key do Vault, verificado pelo gateway de Edge Functions
-- do Supabase, não pela function em si).
--
-- "A cada 3 dias" via cron padrão (sem coluna de estado extra) usa
-- dia-do-mês múltiplo de 3 (*/3) — é a forma mais simples, mas tem uma
-- imprecisão conhecida na virada do mês (dia 31 -> dia 1 é só 1 dia de
-- intervalo, não 3) — aceitável pra esse caso de uso (não é crítico ter
-- exatamente 72h entre disparos). Roda 9h da manhã, horário do servidor.
SELECT cron.schedule(
  'lembrete-avaliacao-cron',
  '0 9 */3 * *',
  $$
  select net.http_post(
    url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/lembrete-avaliacao',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_dispatch_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
