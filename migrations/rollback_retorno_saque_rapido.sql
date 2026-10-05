-- Desfaz migrations/retorno_saque_rapido.sql. NÃO desfaz valores já somados ao
-- caixa: se algum retorno foi aprovado, subtrair valor_total dele do caixa
-- (configuracoes 'caixa_saque_rapido') ANTES de apagar a tabela.
BEGIN;
DROP FUNCTION IF EXISTS public.aprovar_retorno_saque_rapido(date, text);
DROP TABLE IF EXISTS public.saque_rapido_retornos;
COMMIT;
