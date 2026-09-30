-- Rollback de recarga_loja_primeira_e_bonus.sql. Os lançamentos feitos pela
-- função continuam em creditos_lojas (são créditos reais); só some a coluna
-- origem/criado_por, as funções, o gatilho e as tabelas feriados/pacotes_recarga.
BEGIN;
DROP TRIGGER IF EXISTS tg_creditos_lojas_origem ON public.creditos_lojas;
DROP FUNCTION IF EXISTS public.fn_creditos_lojas_origem();
DROP FUNCTION IF EXISTS public.creditar_recarga_loja(uuid, numeric, text, text);
DROP FUNCTION IF EXISTS public.info_recarga_loja(uuid);
DROP FUNCTION IF EXISTS public.loja_ja_recarregou(uuid);
DROP FUNCTION IF EXISTS public.janela_bonus_recarga(date);
DROP FUNCTION IF EXISTS public.nesimo_dia_util(date, int);
DROP FUNCTION IF EXISTS public.eh_dia_util(date);
DROP FUNCTION IF EXISTS public.hoje_brasilia();
DROP INDEX IF EXISTS public.idx_creditos_lojas_loja_origem;
ALTER TABLE public.creditos_lojas DROP COLUMN IF EXISTS criado_por;
ALTER TABLE public.creditos_lojas DROP COLUMN IF EXISTS origem;
DROP TABLE IF EXISTS public.pacotes_recarga;
DROP TABLE IF EXISTS public.feriados;
COMMIT;
