-- Rollback de aviso_vaga_nova.sql.
BEGIN;
DROP TRIGGER IF EXISTS tg_aviso_vaga_nova ON public.vagas_motoboy_fixo;
DROP FUNCTION IF EXISTS public.fn_aviso_vaga_nova();
DROP FUNCTION IF EXISTS public.entregadores_para_vaga(uuid);
ALTER TABLE public.vagas_motoboy_fixo DROP COLUMN IF EXISTS aviso_nova_enviado_em;
COMMIT;
