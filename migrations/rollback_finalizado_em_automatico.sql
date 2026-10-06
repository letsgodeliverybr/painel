-- Desfaz migrations/finalizado_em_automatico.sql (as datas já preenchidas ficam).
BEGIN;
DROP TRIGGER IF EXISTS tg_finalizado_em_automatico ON public.pedidos;
DROP FUNCTION IF EXISTS public.fn_finalizado_em_automatico();
COMMIT;
