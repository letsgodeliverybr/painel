-- Desfaz migrations/od_teste_nao_vira_pronto.sql.
BEGIN;
DROP TRIGGER IF EXISTS tg_od_teste_nao_vira_pronto ON public.pedidos;
DROP FUNCTION IF EXISTS public.fn_od_teste_nao_vira_pronto();
COMMIT;
