-- Aviso de cancelamento no app do entregador. PROPOSTA 2026-10-06, NÃO APLICADA.
-- Rollback: rollback_aviso_cancelamento_entregador.sql
-- Problema: cancelar (painel, API Open Delivery, iFood) só troca o status para
-- 'cancelado' e mantém motoboy_id. A tela de entrega do app só volta ao início
-- com o aviso "Este pedido foi cancelado pelo administrador" quando motoboy_id
-- fica vazio (ou o status volta a recebido/pronto) — então o entregador NÃO é
-- avisado e pode seguir rodando.
-- Correção (um ponto só, vale para todos os caminhos de cancelamento): ao
-- passar para 'cancelado', motoboy_id vira NULL e o entregador fica guardado em
-- entregador_id (quem era). Relatórios e telas usam motoboy_id || entregador_id,
-- então continuam mostrando o entregador do pedido cancelado.
-- Não altera nenhuma linha existente; só age em cancelamentos daqui em diante.
-- Dinheiro: pagamento ao entregador, cobrança e faturas só leem pedidos
-- 'finalizado' — este gatilho só age em 'cancelado'.
BEGIN;
CREATE OR REPLACE FUNCTION public.fn_cancelado_solta_entregador() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelado' AND OLD.status IS DISTINCT FROM 'cancelado' AND NEW.motoboy_id IS NOT NULL THEN
    NEW.entregador_id := coalesce(NEW.entregador_id, NEW.motoboy_id);
    NEW.motoboy_id := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_cancelado_solta_entregador ON public.pedidos;
CREATE TRIGGER tg_cancelado_solta_entregador BEFORE UPDATE OF status ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_cancelado_solta_entregador();
COMMIT;
