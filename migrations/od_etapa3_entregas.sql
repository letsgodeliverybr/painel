-- OPEN DELIVERY v1.7.1 — ETAPA 3 (núcleo: criar entrega e consultar status).
-- PROPOSTA 2026-10-06, NÃO APLICADA. Rollback: rollback_od_etapa3_entregas.sql
-- Depende das etapas 1 e 2. Executável SÓ pela função de servidor.
-- Regras decididas: coordenada de entrega obrigatória (422); só faturamento
-- (loja de crédito recusada até a etapa 7, carteira nunca tocada); só moto
-- (MOTORBIKE_BAG/MOTORBIKE_BOX); retorno à loja e pagamento na entrega ficam
-- para a etapa 6d (recusados com 422). A loja vem SEMPRE do token.
-- Taxa calculada aqui pela tabela de cobrança DA LOJA (mesma regra de
-- _calcValorFaixa do app.js: 1ª faixa com km <= km_ate, senão a última, +
-- km adicional acima da última faixa; km 0 conta como 1). Sem preço
-- dinâmico e sem gorjeta nesta etapa.
-- MODO TESTE: credencial com modo_teste=true cria pedidos marcados
-- (pedidos.od_teste=true) com status 'recebido' e recebido_em NULO — o
-- auto-pronto (só pega recebido_em preenchido) e o despacho (só pega
-- 'pronto') ignoram, então nenhum entregador recebe oferta. A cobrança e o
-- pagamento ao entregador também passam a ignorar od_teste (diff do app.js).
-- DISTÂNCIA: a função de servidor manda a distância de rota (Google, com
-- cache). Se não conseguir, manda p_fator_reta: com fator, usa linha reta x
-- fator; sem fator (NULL), recusa com 503 — decisão de configuração.
BEGIN;

ALTER TABLE public.od_credenciais ADD COLUMN IF NOT EXISTS modo_teste boolean NOT NULL DEFAULT false;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS od_teste boolean NOT NULL DEFAULT false;

-- Cache de rota por par de pontos (arredondados a ~11 m), 30 dias
CREATE TABLE IF NOT EXISTS public.od_rotas_cache (
  origem_lat numeric(9,4) NOT NULL, origem_lng numeric(9,4) NOT NULL,
  destino_lat numeric(9,4) NOT NULL, destino_lng numeric(9,4) NOT NULL,
  km numeric(8,2) NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (origem_lat, origem_lng, destino_lat, destino_lng)
);
ALTER TABLE public.od_rotas_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.od_rotas_cache FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.od_rota_cache_buscar(olat numeric, olng numeric, dlat numeric, dlng numeric) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT km FROM public.od_rotas_cache
   WHERE origem_lat = round(olat, 4) AND origem_lng = round(olng, 4) AND destino_lat = round(dlat, 4) AND destino_lng = round(dlng, 4)
     AND criado_em > now() - interval '30 days';
$$;
CREATE OR REPLACE FUNCTION public.od_rota_cache_gravar(olat numeric, olng numeric, dlat numeric, dlng numeric, p_km numeric) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.od_rotas_cache (origem_lat, origem_lng, destino_lat, destino_lng, km)
  VALUES (round(olat, 4), round(olng, 4), round(dlat, 4), round(dlng, 4), round(p_km, 2))
  ON CONFLICT (origem_lat, origem_lng, destino_lat, destino_lng) DO UPDATE SET km = EXCLUDED.km, criado_em = now();
$$;

-- Data/hora no formato da especificação (UTC, ISO 8601). Colunas de pedidos
-- sem fuso guardam o horário de Brasília.
CREATE OR REPLACE FUNCTION public.od_iso_brt(p timestamp) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p IS NULL THEN NULL
    ELSE to_char((p AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END;
$$;
CREATE OR REPLACE FUNCTION public.od_iso_tz(p timestamptz) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p IS NULL THEN NULL ELSE to_char(p AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END;
$$;

CREATE OR REPLACE FUNCTION public.od_coordenada_valida(lat numeric, lng numeric) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT lat IS NOT NULL AND lng IS NOT NULL AND NOT (lat = 0 AND lng = 0)
     AND lat BETWEEN -34 AND 6 AND lng BETWEEN -74 AND -32;
$$;

-- Distância em linha reta (km) — usada só se a função de servidor não mandar a distância de rota.
CREATE OR REPLACE FUNCTION public.od_haversine_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT round((6371 * 2 * asin(sqrt(
    power(sin(radians((lat2 - lat1) / 2)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians((lng2 - lng1) / 2)), 2))))::numeric, 2);
$$;

-- Valor da faixa (espelho de _calcValorFaixa, sem preço dinâmico/gorjeta)
CREATE OR REPLACE FUNCTION public.od_valor_faixa(p_tabela_id uuid, p_km numeric, p_retorno boolean) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_km numeric := coalesce(nullif(p_km, 0), 1); f record; v_max numeric; v_adic numeric; v_base numeric;
BEGIN
  SELECT * INTO f FROM public.tabelas_preco_faixas WHERE tabela_id = p_tabela_id AND v_km <= km_ate::numeric
   ORDER BY km_ate::numeric ASC LIMIT 1;
  IF NOT FOUND THEN
    SELECT * INTO f FROM public.tabelas_preco_faixas WHERE tabela_id = p_tabela_id ORDER BY km_ate::numeric DESC LIMIT 1;
    IF NOT FOUND THEN RETURN NULL; END IF;
  END IF;
  v_base := coalesce(CASE WHEN p_retorno THEN f.valor_com_retorno ELSE f.valor_sem_retorno END, 0);
  SELECT max(km_ate::numeric) INTO v_max FROM public.tabelas_preco_faixas WHERE tabela_id = p_tabela_id;
  SELECT coalesce(km_adicional_valor, 0) INTO v_adic FROM public.tabelas_preco WHERE id = p_tabela_id;
  IF coalesce(v_adic, 0) > 0 AND v_km > v_max THEN v_base := v_base + (v_km - v_max) * v_adic; END IF;
  RETURN round(v_base, 2);
END $$;

CREATE OR REPLACE FUNCTION public.od_resposta(p_status int, p_title text) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$ SELECT jsonb_build_object('status', p_status, 'body', jsonb_build_object('title', p_title, 'status', p_status)) $$;

-- POST /v1/logistics/delivery
CREATE OR REPLACE FUNCTION public.od_criar_entrega(
  p_credencial_id uuid, p_loja_id uuid, p_body jsonb, p_distancia_km numeric, p_fator_reta numeric, p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b jsonb := coalesce(p_body, '{}'::jsonb);
  v_order text := left(nullif(trim(b->>'orderId'), ''), 100);
  v_display text := left(nullif(trim(b->>'orderDisplayId'), ''), 50);
  da jsonb := b->'deliveryAddress';
  v_lat numeric; v_lng numeric; v_km numeric; v_tipos jsonb;
  l record; c record; v_existente record; v_hoje int;
  v_taxa numeric; v_taxa_moto numeric; v_agora timestamp := (now() AT TIME ZONE 'America/Sao_Paulo');
  v_delivery uuid := gen_random_uuid(); v_endereco text; v_res jsonb;
  v_tab_cob uuid; v_tab_pag uuid; v_teste boolean;
BEGIN
  -- 400: campos obrigatórios / formato
  IF v_order IS NULL OR v_display IS NULL OR jsonb_typeof(da) IS DISTINCT FROM 'object'
     OR nullif(trim(b->>'customerName'), '') IS NULL OR jsonb_typeof(b->'vehicle') IS DISTINCT FROM 'object' THEN
    v_res := od_resposta(400, 'missing_required_fields');
  ELSE
    -- idempotência: mesmo orderId na mesma loja devolve a entrega já criada
    SELECT id, od_delivery_id INTO v_existente FROM public.pedidos WHERE loja_id = p_loja_id AND od_order_id = v_order;
    IF FOUND THEN
      v_res := jsonb_build_object('status', 202, 'body', jsonb_build_object(
        'deliveryId', v_existente.od_delivery_id, 'event', 'ACCEPTED', 'completion', '{}'::jsonb), 'idempotente', true);
    END IF;
  END IF;

  IF v_res IS NULL THEN
    BEGIN
      v_lat := (da->>'latitude')::numeric; v_lng := (da->>'longitude')::numeric;
    EXCEPTION WHEN others THEN v_lat := NULL; v_lng := NULL; END;
    v_tipos := CASE jsonb_typeof(b->'vehicle'->'type') WHEN 'array' THEN b->'vehicle'->'type'
                 WHEN 'string' THEN jsonb_build_array(b->'vehicle'->>'type') ELSE '[]'::jsonb END;
    SELECT * INTO l FROM public.lojas WHERE id = p_loja_id;
    SELECT * INTO c FROM public.od_credenciais WHERE id = p_credencial_id;
    SELECT count(*) INTO v_hoje FROM public.pedidos
     WHERE od_credencial_id = p_credencial_id AND created_at >= date_trunc('day', v_agora);

    IF l.id IS NULL OR coalesce(l.ativo, false) = false THEN v_res := od_resposta(403, 'merchant_inactive');
    ELSIF coalesce(l.tipo_cobranca, '') <> 'faturamento' THEN v_res := od_resposta(422, 'merchant_billing_not_supported');
    ELSIF NOT od_coordenada_valida(v_lat, v_lng) THEN v_res := od_resposta(422, 'invalid_delivery_coordinates');
    ELSIF NOT (v_tipos ? 'MOTORBIKE_BAG' OR v_tipos ? 'MOTORBIKE_BOX') THEN v_res := od_resposta(422, 'vehicle_not_supported');
    ELSIF coalesce((b->>'returnToMerchant')::boolean, false) THEN v_res := od_resposta(422, 'return_to_merchant_not_supported');
    ELSIF upper(coalesce(b->'payments'->>'method', 'ONLINE')) = 'OFFLINE' THEN v_res := od_resposta(422, 'offline_payment_not_supported');
    ELSIF NOT od_coordenada_valida(l.latitude::numeric, l.longitude::numeric) THEN
      v_res := od_resposta(422, 'merchant_not_configured');
    ELSIF v_hoje >= c.limite_pedidos_dia THEN v_res := od_resposta(429, 'daily_limit_reached');
    END IF;
  END IF;

  IF v_res IS NULL THEN
    -- tabelas da loja; sem tabela própria usa a padrão, igual ao painel (TABELA_COBRANCA_ID / TABELA_PAGAMENTO_ID do app.js)
    v_tab_cob := coalesce(l.tabela_cobranca_id, 'a1e291f2-f815-4f67-86bf-cd4e95fb5fb6'::uuid);
    v_tab_pag := coalesce(l.tabela_pagamento_id, '7bf1cf41-b3f2-4694-b326-d4e830dae8e1'::uuid);
    v_teste := coalesce(c.modo_teste, false);
    v_km := coalesce(p_distancia_km,
      CASE WHEN p_fator_reta IS NOT NULL THEN round(od_haversine_km(l.latitude::numeric, l.longitude::numeric, v_lat, v_lng) * p_fator_reta, 2) END);
    IF v_km IS NULL THEN
      v_res := od_resposta(503, 'route_unavailable');
    ELSIF v_km > 32 THEN
      v_res := od_resposta(422, 'distance_out_of_range');
    ELSE
      v_taxa := od_valor_faixa(v_tab_cob, v_km, false);
      v_taxa_moto := od_valor_faixa(v_tab_pag, v_km, false);
      v_endereco := concat_ws(', ', nullif(trim(concat_ws(' ', da->>'street', da->>'number')), ''), nullif(da->>'complement', ''),
                              nullif(da->>'district', ''), nullif(concat_ws(' - ', da->>'city', da->>'state'), ''));
      INSERT INTO public.pedidos (
        numero, numero_loja, endereco, valor, descricao, cliente, telefone, gorjeta, status, status_detalhado, origem,
        loja_id, latitude, longitude, endereco_coleta, latitude_coleta, longitude_coleta, contato_coleta,
        distancia_km, taxa_entrega, taxa_motoboy, taxa_entrega_motoboy, pontos, pontos_base, com_retorno, retirada,
        pagamento_confirmado, recebido_em, pronto_em, created_at, updated_at,
        od_order_id, od_delivery_id, od_credencial_id, od_teste)
      VALUES (
        v_display, v_display, v_endereco, 0, left(b->>'specialInstructions', 500), left(b->>'customerName', 120),
        left(b->>'customerPhone', 30), 0,
        CASE WHEN v_teste THEN 'recebido' ELSE 'pronto' END, CASE WHEN v_teste THEN 'recebido' ELSE 'pronto' END, 'open_delivery',
        p_loja_id, v_lat, v_lng, l.endereco, l.latitude, l.longitude, l.nome,
        round(v_km, 2), v_taxa, v_taxa_moto, v_taxa_moto, coalesce(l.pontos_padrao, 4), coalesce(l.pontos_padrao, 4), false, false,
        true, CASE WHEN v_teste THEN NULL ELSE v_agora END, CASE WHEN v_teste THEN NULL ELSE v_agora END, v_agora, v_agora,
        v_order, v_delivery, p_credencial_id, v_teste)
      ON CONFLICT (loja_id, od_order_id) WHERE od_order_id IS NOT NULL DO NOTHING;
      IF NOT FOUND THEN -- corrida: outra requisição com o mesmo orderId gravou primeiro
        SELECT od_delivery_id INTO v_delivery FROM public.pedidos WHERE loja_id = p_loja_id AND od_order_id = v_order;
      END IF;
      v_res := jsonb_build_object('status', 202, 'body', jsonb_build_object(
        'deliveryId', v_delivery, 'event', 'ACCEPTED',
        'completion', jsonb_build_object('estimate', od_iso_tz(now() + make_interval(mins => (20 + ceil(v_km * 3))::int)))));
    END IF;
  END IF;

  INSERT INTO public.od_acessos (credencial_id, loja_id, rota, metodo, http_status, ip, detalhe)
  VALUES (p_credencial_id, p_loja_id, '/v1/logistics/delivery', 'POST', (v_res->>'status')::int, nullif(left(p_ip, 64), ''),
          left(coalesce(v_res->'body'->>'title', CASE WHEN v_res ? 'idempotente' THEN 'idempotente' END, 'criado') || ' orderId=' || coalesce(v_order, '-'), 200));
  RETURN v_res - 'idempotente';
END $$;

-- GET /v1/logistics/delivery/{orderId} — 404 para pedido de outra loja (sem revelar que existe)
CREATE OR REPLACE FUNCTION public.od_consultar_entrega(p_credencial_id uuid, p_loja_id uuid, p_order_id text, p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; l record; c record; e record; v_ev jsonb := '[]'::jsonb; v_res jsonb;
  add_ev jsonb;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE loja_id = p_loja_id AND od_order_id = left(p_order_id, 100);
  IF NOT FOUND THEN
    v_res := od_resposta(404, 'not_found');
  ELSE
    SELECT * INTO l FROM public.lojas WHERE id = p.loja_id;
    SELECT * INTO c FROM public.od_credenciais WHERE id = p_credencial_id;
    SELECT id, nome, telefone INTO e FROM public.entregadores WHERE id = coalesce(p.motoboy_id, p.entregador_id);
    SELECT coalesce(jsonb_agg(x ORDER BY x->>'datetime', ord), '[]'::jsonb) INTO v_ev FROM (
      SELECT jsonb_build_object('type', t, 'datetime', dt) x, ord FROM (VALUES
        (1, 'ACCEPTED',            od_iso_brt(p.created_at)),
        (2, 'PICKUP_ONGOING',      od_iso_brt(p.aceito_em)),
        (3, 'ARRIVED_AT_MERCHANT', od_iso_brt(p.chegou_local_em)),
        (4, 'ORDER_PICKED',        od_iso_brt(p.em_rota_em)),
        (5, 'DELIVERY_ONGOING',    od_iso_brt(p.em_rota_em)),
        (6, 'ARRIVED_AT_CUSTOMER', od_iso_tz(p.chegou_destino_em)),
        (7, 'ORDER_DELIVERED',     CASE WHEN p.status = 'finalizado' THEN od_iso_brt(p.finalizado_em) END),
        (8, 'DELIVERY_FINISHED',   CASE WHEN p.status = 'finalizado' THEN od_iso_brt(p.finalizado_em) END),
        (9, 'CANCELLED',           CASE WHEN p.status = 'cancelado' THEN od_iso_brt(p.updated_at) END)
      ) v(ord, t, dt) WHERE dt IS NOT NULL) s;
    v_res := jsonb_build_object('status', 200, 'body', jsonb_strip_nulls(jsonb_build_object(
      'deliveryId', p.od_delivery_id, 'orderId', p.od_order_id, 'orderDisplayId', p.numero_loja,
      'merchant', jsonb_build_object('id', coalesce(c.parceiro_merchant_id, p.loja_id::text), 'name', l.nome),
      'customerName', p.cliente, 'customerPhone', p.telefone,
      'events', v_ev,
      'vehicle', jsonb_build_object('type', jsonb_build_array('MOTORBIKE_BAG'), 'container', 'NORMAL'),
      'deliveryPerson', CASE WHEN e.id IS NOT NULL THEN jsonb_build_object('id', e.id, 'name', e.nome, 'phone', e.telefone) END)));
  END IF;
  INSERT INTO public.od_acessos (credencial_id, loja_id, rota, metodo, http_status, ip, detalhe)
  VALUES (p_credencial_id, p_loja_id, '/v1/logistics/delivery/{orderId}', 'GET', (v_res->>'status')::int, nullif(left(p_ip, 64), ''),
          left('orderId=' || coalesce(p_order_id, '-'), 200));
  RETURN v_res;
END $$;

REVOKE EXECUTE ON FUNCTION public.od_valor_faixa(uuid, numeric, boolean),
  public.od_rota_cache_buscar(numeric, numeric, numeric, numeric), public.od_rota_cache_gravar(numeric, numeric, numeric, numeric, numeric),
  public.od_criar_entrega(uuid, uuid, jsonb, numeric, numeric, text),
  public.od_consultar_entrega(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.od_valor_faixa(uuid, numeric, boolean),
  public.od_rota_cache_buscar(numeric, numeric, numeric, numeric), public.od_rota_cache_gravar(numeric, numeric, numeric, numeric, numeric),
  public.od_criar_entrega(uuid, uuid, jsonb, numeric, numeric, text),
  public.od_consultar_entrega(uuid, uuid, text, text) TO service_role;
COMMIT;
