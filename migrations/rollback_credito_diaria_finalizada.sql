-- Desfaz migrations/credito_diaria_finalizada.sql: tira o gatilho, a função,
-- os créditos/estornos de diária lançados por ela (vaga_id preenchido), o
-- índice e a coluna. Créditos manuais (vaga_id nulo) não são tocados.
-- Atenção: se algum saque já usou o crédito da diária, o saldo do
-- entregador cai nesse valor ao rodar isto.
BEGIN;
DROP TRIGGER IF EXISTS tg_credito_diaria_finalizada ON public.vagas_motoboy_fixo;
DROP FUNCTION IF EXISTS public.fn_credito_diaria_finalizada();
DELETE FROM public.creditos_entregadores WHERE vaga_id IS NOT NULL;
DROP INDEX IF EXISTS public.creditos_entregadores_vaga_tipo_uniq;
ALTER TABLE public.creditos_entregadores DROP COLUMN IF EXISTS vaga_id;
COMMIT;
