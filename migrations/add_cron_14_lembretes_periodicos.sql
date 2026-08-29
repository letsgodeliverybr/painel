-- 14 crons novos pra aba "Disparar Notificações": 7 dias da semana
-- completos (segunda a domingo), 2 horários por dia (09:09 e 18:18,
-- horário de Brasília) — 1 job por combinação dia+horário, todos chamando
-- a MESMA function genérica (lembrete-periodico), parametrizada por
-- {chave:'<dia>_<horario>'} no body. Cada job lê o texto daquele card
-- específico em `configuracoes` (chaves notif_<chave>_titulo/corpo) — ver
-- lembrete-periodico/index.ts.
--
-- Fuso: banco roda em UTC (confirmado antes, mesma lição de
-- fix_fuso_cron_notificacoes_9h_brasilia.sql) — Brasília é UTC-3 sem
-- horário de verão desde 2019, então:
--   09:09 Brasília = 12:09 UTC
--   18:18 Brasília = 21:18 UTC
--
-- Dia da semana no cron: 0=domingo, 1=segunda, ..., 6=sábado (padrão
-- cron.schedule já usado neste projeto).
--
-- Auth: x-webhook-secret, mesmo padrão de todo o resto (ver
-- align_cron_notificacoes_72h.sql).
DO $$
DECLARE
  dias jsonb := '[
    {"chave":"seg","dow":1},
    {"chave":"ter","dow":2},
    {"chave":"qua","dow":3},
    {"chave":"qui","dow":4},
    {"chave":"sex","dow":5},
    {"chave":"sab","dow":6},
    {"chave":"dom","dow":0}
  ]'::jsonb;
  dia jsonb;
BEGIN
  FOR dia IN SELECT * FROM jsonb_array_elements(dias) LOOP
    -- Manhã, 09:09 Brasília = 12:09 UTC
    PERFORM cron.schedule(
      'lembrete-periodico-' || (dia->>'chave') || '-manha-cron',
      '9 12 * * ' || (dia->>'dow'),
      format($f$
        select net.http_post(
          url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/lembrete-periodico',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', 'letsgo2026secret'
          ),
          body := jsonb_build_object('chave', '%s_manha')
        );
      $f$, dia->>'chave')
    );

    -- Noite, 18:18 Brasília = 21:18 UTC
    PERFORM cron.schedule(
      'lembrete-periodico-' || (dia->>'chave') || '-noite-cron',
      '18 21 * * ' || (dia->>'dow'),
      format($f$
        select net.http_post(
          url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/lembrete-periodico',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', 'letsgo2026secret'
          ),
          body := jsonb_build_object('chave', '%s_noite')
        );
      $f$, dia->>'chave')
    );
  END LOOP;
END $$;
