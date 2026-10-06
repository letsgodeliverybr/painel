-- finalizado_em sempre preenchido ao finalizar. PROPOSTA 2026-10-06, NÃO APLICADA.
-- Rollback: rollback_finalizado_em_automatico.sql
-- Causa: ao receber o evento CON (pedido concluído no iFood), ifood-polling e
-- ifood-status-sync mudam o status para 'finalizado' SEM gravar finalizado_em.
-- Gerar Cobranças, faturas e Gerar Pagamentos filtram por finalizado_em, então
-- esses pedidos ficam fora da cobrança e do pagamento.
-- Correção (no banco, sem mexer nas funções do iFood durante a homologação):
-- se um pedido passa a 'finalizado' sem finalizado_em, o banco preenche com a
-- hora atual de Brasília (mesmo formato das outras colunas sem fuso). Quem já
-- grava a data (painel, app do entregador) não é afetado.
BEGIN;
CREATE OR REPLACE FUNCTION public.fn_finalizado_em_automatico() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'finalizado' AND NEW.finalizado_em IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'finalizado') THEN
    NEW.finalizado_em := (now() AT TIME ZONE 'America/Sao_Paulo');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_finalizado_em_automatico ON public.pedidos;
CREATE TRIGGER tg_finalizado_em_automatico BEFORE INSERT OR UPDATE OF status ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_finalizado_em_automatico();
COMMIT;
