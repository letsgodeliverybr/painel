-- Desfaz migrations/od_etapa6b_cancelamento.sql. Pedidos já cancelados
-- continuam cancelados (o motivo some junto com a coluna).
BEGIN;
DROP FUNCTION IF EXISTS public.od_cancelar_entrega(uuid, uuid, text, jsonb, text);
ALTER TABLE public.pedidos DROP COLUMN IF EXISTS od_cancelamento;
COMMIT;
