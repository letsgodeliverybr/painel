-- Desfaz migrations/od_etapa4_webhook.sql: para o agendamento, remove o
-- gatilho e as funções. Eventos já enfileirados ficam em od_eventos (histórico).
BEGIN;
SELECT cron.unschedule('od-eventos-cron') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'od-eventos-cron');
DROP TRIGGER IF EXISTS tg_od_enfileirar_evento ON public.pedidos;
DROP FUNCTION IF EXISTS public.fn_od_enfileirar_evento();
DROP FUNCTION IF EXISTS public.od_eventos_concluir(bigint, integer, text);
DROP FUNCTION IF EXISTS public.od_eventos_reservar(integer);
DROP FUNCTION IF EXISTS public.od_payload_evento(public.pedidos, text);
COMMIT;
