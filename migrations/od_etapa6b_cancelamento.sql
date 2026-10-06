-- OPEN DELIVERY v1.7.1 — ETAPA 6b (POST /v1/logistics/cancel/{orderId}).
-- PROPOSTA 2026-10-06, NÃO APLICADA. Rollback: rollback_od_etapa6b_cancelamento.sql
-- A loja vem do token. Regras (decisão pendente sobre taxa — ver resposta):
--   já cancelado            -> 202 {additionalCharges:false} (idempotente)
--   finalizado              -> 422 already_delivered
--   coletado / a caminho do cliente (em_rota, chegou_destino, retornando)
--                           -> 422 cannot_cancel_after_pickup
--   antes da coleta (recebido, pronto, aguardando, aceito, no_local,
--   chegou_local, chegou_no_local) -> cancela; additionalCharges = false
-- Cancelar = mesmo efeito do painel (status 'cancelado'); o despacho expira as
-- ofertas sozinho e o app do entregador recebe a mudança como hoje. Faturamento:
-- pedido cancelado não entra na fatura; carteira não é tocada. O webhook
-- CANCELLED sai pela etapa 4.
BEGIN;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS od_cancelamento jsonb; -- {reason, action, message, em}

CREATE OR REPLACE FUNCTION public.od_cancelar_entrega(p_credencial_id uuid, p_loja_id uuid, p_order_id text, p_body jsonb, p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; v_reason text := upper(coalesce(p_body->>'reason', '')); v_res jsonb;
BEGIN
  IF v_reason NOT IN ('CONSUMER_CANCELLATION_REQUESTED','NO_SHOW','PROBLEM_AT_MERCHANT','HIGH_ACCEPTANCE_TIME',
                      'INCORRECT_ORDER_OR_PRODUCT_PICKUP','PROBLEM_RESOLUTION','DISCOMBINE_ORDER','OTHER') THEN
    v_res := od_resposta(400, 'invalid_reason');
  ELSE
    SELECT * INTO p FROM public.pedidos WHERE loja_id = p_loja_id AND od_order_id = left(p_order_id, 100) FOR UPDATE;
    IF NOT FOUND THEN v_res := od_resposta(404, 'not_found');
    ELSIF p.status = 'cancelado' THEN
      v_res := jsonb_build_object('status', 202, 'body', jsonb_build_object('additionalCharges', false));
    ELSIF p.status = 'finalizado' THEN v_res := od_resposta(422, 'already_delivered');
    ELSIF p.status IN ('em_rota', 'chegou_destino', 'retornando') THEN v_res := od_resposta(422, 'cannot_cancel_after_pickup');
    ELSE
      UPDATE public.pedidos SET status = 'cancelado', status_detalhado = 'cancelado',
             updated_at = (now() AT TIME ZONE 'America/Sao_Paulo'),
             od_cancelamento = jsonb_build_object('reason', v_reason, 'action', left(p_body->>'action', 40),
                                                  'message', left(p_body->>'message', 300), 'em', now())
       WHERE id = p.id;
      v_res := jsonb_build_object('status', 202, 'body', jsonb_build_object('additionalCharges', false));
    END IF;
  END IF;
  INSERT INTO public.od_acessos (credencial_id, loja_id, rota, metodo, http_status, ip, detalhe)
  VALUES (p_credencial_id, p_loja_id, '/v1/logistics/cancel/{orderId}', 'POST', (v_res->>'status')::int,
          nullif(left(p_ip, 64), ''), left('orderId=' || coalesce(p_order_id, '-') || ' reason=' || v_reason, 200));
  RETURN v_res;
END $$;
REVOKE EXECUTE ON FUNCTION public.od_cancelar_entrega(uuid, uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.od_cancelar_entrega(uuid, uuid, text, jsonb, text) TO service_role;
COMMIT;
