-- Desfaz migrations/od_teste_sem_alocacao.sql.
BEGIN;
DROP TRIGGER IF EXISTS tg_aa_od_teste_sem_alocacao ON public.pedidos;
DROP FUNCTION IF EXISTS public.fn_od_teste_sem_alocacao();
COMMIT;
