-- Parte 3 do NOTIFICACOES_MAPA.md (2026-09-03): trigger único que resolve
-- 2 bugs de uma vez, ambos com a mesma causa raiz (despacho_fila nunca era
-- limpa quando um pedido saía de 'pronto' fora do despacho-engine):
--
-- 1. Loop não parava ao CANCELAR um pedido (bug reportado) — despacho_fila
--    ficava 'aguardando' pra sempre, AlertaPedidoService nunca era avisado
--    (só reage a mudanças em despacho_fila, não em pedidos).
-- 2. Loop não parava pros entregadores que NÃO aceitaram quando outro
--    aceitou (achado na auditoria, não reportado ainda) — mesma causa: só
--    a linha do entregador que aceita é atualizada pelo client
--    (_aceitar()); as ofertas 'aguardando' dos demais ficavam intactas até
--    o timeout natural de até 12min (tempoReset).
--
-- Dispara sempre que um pedido SAI de 'pronto' pra qualquer outro status
-- (aceito, cancelado, etc.) — expira toda oferta 'aguardando' desse
-- pedido, EXCETO a do entregador que acabou de ser atribuído (NEW.
-- motoboy_id/entregador_id), pra não competir com o UPDATE que o próprio
-- client já faz na hora do aceite (_aceitar()/RotaDisponivelScreen._aceitar()
-- marcam a própria linha como 'aceito' logo em seguida — sem essa
-- exclusão, esse trigger correria primeiro e a linha já estaria
-- 'expirado' quando o client tentasse marcar 'aceito', silenciosamente
-- não batendo o WHERE status='aguardando' do UPDATE dele).
--
-- Não interfere com fn_intercept_realocacao_manual (realocação manual):
-- aquele trigger só roda quando OLD.status NÃO é 'pronto' (pedido já
-- aceito sendo reatribuído) e força NEW.status de volta pra 'pronto' —
-- ou seja, a condição OLD.status='pronto' deste trigger novo nunca bate
-- nesse caso, sem conflito.
CREATE OR REPLACE FUNCTION public.fn_expirar_despacho_fila_pedido_nao_pronto()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'pronto' AND NEW.status IS DISTINCT FROM 'pronto' THEN
    UPDATE public.despacho_fila
    SET status = 'expirado'
    WHERE pedido_id = NEW.id
      AND status = 'aguardando'
      AND entregador_id IS DISTINCT FROM COALESCE(NEW.motoboy_id, NEW.entregador_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_expirar_despacho_fila_pedido_nao_pronto ON public.pedidos;
CREATE TRIGGER tg_expirar_despacho_fila_pedido_nao_pronto
AFTER UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_expirar_despacho_fila_pedido_nao_pronto();
