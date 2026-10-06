-- OPEN DELIVERY v1.7.1 — ETAPA 4 (webhook /deliveryEvent). PROPOSTA 2026-10-06, NÃO APLICADA.
-- Rollback: rollback_od_etapa4_webhook.sql. Depende das etapas 1–3.
-- 1) Gatilho em pedidos (só origem open_delivery com credencial) enfileira os
--    eventos em od_eventos a cada mudança de status — nunca duplica (UNIQUE
--    pedido+evento) e numera a ordem (seq) por pedido.
-- 2) A função de servidor (open-delivery, rota interna) reserva e envia; um
--    pedido só tem o PRÓXIMO evento enviado depois que o anterior foi entregue
--    ou desistido (ordem garantida). Falha: nova tentativa com espera crescente
--    (1, 2, 5, 10, 20, 30, 60, 60, 120, 180, 240, 360 min ≈ 18 h); depois disso,
--    'descartado' (reenviável pela tela de admin da etapa 5).
-- 3) Agendamento a cada minuto chama a rota interna com a chave do cofre
--    (cron_dispatch_key, mesmo padrão do ifood-status-sync-cron).
BEGIN;

CREATE OR REPLACE FUNCTION public.od_payload_evento(p public.pedidos, p_evento text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE l record; c record; e record;
BEGIN
  SELECT id, nome INTO l FROM public.lojas WHERE id = p.loja_id;
  SELECT parceiro_merchant_id INTO c FROM public.od_credenciais WHERE id = p.od_credencial_id;
  SELECT id, nome, telefone INTO e FROM public.entregadores WHERE id = coalesce(p.motoboy_id, p.entregador_id);
  RETURN jsonb_strip_nulls(jsonb_build_object(
    'deliveryId', p.od_delivery_id, 'orderId', p.od_order_id, 'orderDisplayId', p.numero_loja,
    'merchant', jsonb_build_object('id', coalesce(c.parceiro_merchant_id, p.loja_id::text), 'name', l.nome),
    'event', jsonb_build_object('type', p_evento, 'datetime', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    'customerName', p.cliente,
    'vehicle', jsonb_build_object('type', jsonb_build_array('MOTORBIKE_BAG'), 'container', 'NORMAL'),
    'deliveryPerson', CASE WHEN e.id IS NOT NULL THEN jsonb_build_object('id', e.id, 'name', e.nome, 'phone', e.telefone) END));
END $$;

CREATE OR REPLACE FUNCTION public.fn_od_enfileirar_evento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_eventos text[]; v_ev text; v_seq int; v_cred record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT id, loja_id, webhook_url, ativo, revogado_em INTO v_cred FROM public.od_credenciais WHERE id = NEW.od_credencial_id;
  IF v_cred.id IS NULL OR v_cred.webhook_url IS NULL OR NOT v_cred.ativo OR v_cred.revogado_em IS NOT NULL THEN RETURN NEW; END IF;
  v_eventos := CASE
    WHEN TG_OP = 'INSERT' THEN ARRAY['ACCEPTED']
    WHEN NEW.status = 'aceito' THEN ARRAY['PICKUP_ONGOING']
    WHEN NEW.status IN ('no_local', 'chegou_local', 'chegou_no_local') THEN ARRAY['ARRIVED_AT_MERCHANT']
    WHEN NEW.status = 'em_rota' THEN ARRAY['ORDER_PICKED', 'DELIVERY_ONGOING']
    WHEN NEW.status = 'chegou_destino' THEN ARRAY['ARRIVED_AT_CUSTOMER']
    WHEN NEW.status = 'finalizado' THEN ARRAY['ORDER_DELIVERED', 'DELIVERY_FINISHED']
    WHEN NEW.status = 'cancelado' THEN ARRAY['CANCELLED']
    ELSE ARRAY[]::text[] END;
  FOREACH v_ev IN ARRAY v_eventos LOOP
    -- depois de encerrado (entregue ou cancelado) não sai mais nada
    IF EXISTS (SELECT 1 FROM public.od_eventos WHERE pedido_id = NEW.id AND evento IN ('DELIVERY_FINISHED', 'CANCELLED')) THEN EXIT; END IF;
    SELECT coalesce(max(seq), 0) + 1 INTO v_seq FROM public.od_eventos WHERE pedido_id = NEW.id;
    INSERT INTO public.od_eventos (pedido_id, credencial_id, loja_id, evento, seq, payload)
    VALUES (NEW.id, v_cred.id, NEW.loja_id, v_ev, v_seq, public.od_payload_evento(NEW, v_ev))
    ON CONFLICT (pedido_id, evento) DO NOTHING;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_od_enfileirar_evento ON public.pedidos;
CREATE TRIGGER tg_od_enfileirar_evento AFTER INSERT OR UPDATE OF status ON public.pedidos
  FOR EACH ROW WHEN (NEW.origem = 'open_delivery' AND NEW.od_credencial_id IS NOT NULL)
  EXECUTE FUNCTION public.fn_od_enfileirar_evento();

-- Reserva o próximo evento de cada pedido (no máximo p_limite), em ordem.
-- 'enviando' vira arrendamento de 2 min: se a função cair, volta a ser elegível.
CREATE OR REPLACE FUNCTION public.od_eventos_reservar(p_limite integer DEFAULT 30)
RETURNS TABLE (id bigint, pedido_id uuid, evento text, seq integer, payload jsonb, tentativas integer,
               webhook_url text, merchant_id text, segredo text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- credencial revogada/inativa: eventos pendentes dela são descartados
  UPDATE public.od_eventos ev SET status = 'descartado', ultimo_erro = 'credencial revogada ou sem webhook'
    FROM public.od_credenciais cr
   WHERE cr.id = ev.credencial_id AND ev.status IN ('pendente', 'falhou', 'enviando')
     AND (NOT cr.ativo OR cr.revogado_em IS NOT NULL OR cr.webhook_url IS NULL);
  RETURN QUERY
  WITH proximos AS (
    SELECT DISTINCT ON (e.pedido_id) e.id
      FROM public.od_eventos e
     WHERE e.status IN ('pendente', 'falhou', 'enviando')
     ORDER BY e.pedido_id, e.seq
  ), elegiveis AS (
    SELECT e.id FROM public.od_eventos e JOIN proximos p ON p.id = e.id
     WHERE e.proxima_tentativa <= now()
     ORDER BY e.criado_em
     LIMIT p_limite
     FOR UPDATE OF e SKIP LOCKED
  ), marcados AS (
    UPDATE public.od_eventos e SET status = 'enviando', proxima_tentativa = now() + interval '2 minutes'
      FROM elegiveis x WHERE e.id = x.id
    RETURNING e.id, e.pedido_id, e.evento, e.seq, e.payload, e.tentativas, e.credencial_id
  )
  SELECT m.id, m.pedido_id, m.evento, m.seq, m.payload, m.tentativas, c.webhook_url,
         coalesce(c.parceiro_merchant_id, c.loja_id::text), s.decrypted_secret
    FROM marcados m
    JOIN public.od_credenciais c ON c.id = m.credencial_id
    JOIN vault.decrypted_secrets s ON s.id = c.secret_vault_id;
END $$;

CREATE OR REPLACE FUNCTION public.od_eventos_concluir(p_id bigint, p_http integer, p_erro text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t int; v_espera int[] := ARRAY[1, 2, 5, 10, 20, 30, 60, 60, 120, 180, 240, 360];
BEGIN
  IF p_http BETWEEN 200 AND 299 THEN
    UPDATE public.od_eventos SET status = 'enviado', enviado_em = now(), ultimo_http = p_http, ultimo_erro = NULL
     WHERE id = p_id;
    RETURN;
  END IF;
  UPDATE public.od_eventos SET tentativas = tentativas + 1, ultimo_http = p_http, ultimo_erro = left(p_erro, 300)
   WHERE id = p_id RETURNING tentativas INTO v_t;
  IF v_t >= array_length(v_espera, 1) THEN
    UPDATE public.od_eventos SET status = 'descartado' WHERE id = p_id;
  ELSE
    UPDATE public.od_eventos SET status = 'falhou', proxima_tentativa = now() + make_interval(mins => v_espera[v_t]) WHERE id = p_id;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.od_payload_evento(public.pedidos, text), public.fn_od_enfileirar_evento(),
  public.od_eventos_reservar(integer), public.od_eventos_concluir(bigint, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.od_eventos_reservar(integer), public.od_eventos_concluir(bigint, integer, text) TO service_role;

-- Agendamento: a cada minuto, mesmo padrão do ifood-status-sync-cron
SELECT cron.schedule('od-eventos-cron', '* * * * *', $cron$
  select net.http_post(
    url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/open-delivery/interno/eventos',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_dispatch_key')),
    body := '{}'::jsonb);
$cron$);
COMMIT;
