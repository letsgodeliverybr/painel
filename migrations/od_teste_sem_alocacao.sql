-- Pedido de TESTE (od_teste=true) não recebe entregador. PROPOSTA 2026-10-06, NÃO APLICADA.
-- Rollback: rollback_od_teste_sem_alocacao.sql
-- Motivo: alocar entregador num pedido que não está 'pronto' dispara a regra de
-- realocação existente (tg_intercept_realocacao_manual): oferta exclusiva de
-- 30 s + push ao entregador. Em pedido de teste o push chegaria, mas o pedido
-- (preso em 'recebido') não aparece para aceitar.
-- Regra: se um pedido de teste ganha entregador (motoboy_id/entregador_id
-- passam de vazio a preenchido), o banco recusa com erro claro. O nome começa
-- com "tg_aa_" para rodar ANTES da regra de realocação (ordem alfabética dos
-- gatilhos BEFORE), então nem a oferta nem o push saem.
-- Pedidos com od_teste=false não são tocados. Testar webhooks: use o seletor
-- de status, sem alocar.
BEGIN;
CREATE OR REPLACE FUNCTION public.fn_od_teste_sem_alocacao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(NEW.motoboy_id, NEW.entregador_id) IS NOT NULL
     AND coalesce(NEW.motoboy_id, NEW.entregador_id) IS DISTINCT FROM coalesce(OLD.motoboy_id, OLD.entregador_id) THEN
    RAISE EXCEPTION USING MESSAGE = 'Pedido de teste do Open Delivery não pode receber entregador. Use o seletor de status para testar.',
      HINT = 'od_teste_sem_alocacao';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_aa_od_teste_sem_alocacao ON public.pedidos;
CREATE TRIGGER tg_aa_od_teste_sem_alocacao BEFORE UPDATE ON public.pedidos
  FOR EACH ROW WHEN (NEW.od_teste) EXECUTE FUNCTION public.fn_od_teste_sem_alocacao();
COMMIT;
