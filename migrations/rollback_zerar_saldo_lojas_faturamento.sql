-- Rollback de zerar_saldo_lojas_faturamento.sql: remove SÓ os ajustes
-- lançados por ela (origem + marcador em criado_por). Nada mais é tocado.
BEGIN;
DELETE FROM public.creditos_lojas
 WHERE origem = 'ajuste_zerar_faturamento' AND criado_por = 'zerar_faturamento_2026-09-30';
COMMIT;
