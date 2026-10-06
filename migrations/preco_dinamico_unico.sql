-- Preço dinâmico numa regra só (painel + API Open Delivery). PROPOSTA 2026-10-06, NÃO APLICADA.
-- Rollback: rollback_preco_dinamico_unico.sql
-- Hoje a regra mora só no app.js (_fetchPdAtual / _getPdCliente) e lê as
-- chaves de configuracoes. Esta função reproduz _fetchPdAtual NO BANCO e passa
-- a ser a única fonte: o painel chama por RPC e a API usa direto.
-- Regra (igual à de hoje na criação de entrega do painel):
--   • global: preco_dinamico (cliente) / preco_dinamico_entregador, ativo se
--     valor > 0 e ativado há menos de 120 min (preco_dinamico[_entregador]_ativado_em)
--   • cidade da loja (lojas.cidade): preco_dinamico_por_cidade /
--     preco_dinamico_entregador_por_cidade -> {cidade: {valor, ativado_em}},
--     mesma janela de 120 min; o do cliente só vale se a lista
--     preco_dinamico_lojas_aplicaveis_cidade da cidade estiver vazia ou tiver a loja
--   • total = global + cidade (cliente e entregador separados)
-- Horários sem fuso são lidos como UTC (igual ao _tsUtc do app.js).
BEGIN;
CREATE OR REPLACE FUNCTION public.preco_dinamico_vigente(p_loja_id uuid, p_momento timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg jsonb := '{}'::jsonb; v_cidade text; c jsonb; ce jsonb; aplic jsonb;
  g_c numeric := 0; g_e numeric := 0; cid_c numeric := 0; cid_e numeric := 0; o_c text; o_e text;
BEGIN
  SELECT coalesce(jsonb_object_agg(chave, valor), '{}'::jsonb) INTO cfg FROM public.configuracoes WHERE chave LIKE 'preco_dinamico%';
  IF public.pd_ativo(cfg->>'preco_dinamico', cfg->>'preco_dinamico_ativado_em', p_momento) THEN
    g_c := (cfg->>'preco_dinamico')::numeric; o_c := 'global'; END IF;
  IF public.pd_ativo(cfg->>'preco_dinamico_entregador', cfg->>'preco_dinamico_entregador_ativado_em', p_momento) THEN
    g_e := (cfg->>'preco_dinamico_entregador')::numeric; o_e := 'global'; END IF;
  SELECT cidade INTO v_cidade FROM public.lojas WHERE id = p_loja_id;
  IF v_cidade IS NOT NULL THEN
    BEGIN c := (cfg->>'preco_dinamico_por_cidade')::jsonb -> v_cidade; EXCEPTION WHEN others THEN c := NULL; END;
    BEGIN ce := (cfg->>'preco_dinamico_entregador_por_cidade')::jsonb -> v_cidade; EXCEPTION WHEN others THEN ce := NULL; END;
    BEGIN aplic := (cfg->>'preco_dinamico_lojas_aplicaveis_cidade')::jsonb -> v_cidade; EXCEPTION WHEN others THEN aplic := NULL; END;
    IF public.pd_ativo(c->>'valor', c->>'ativado_em', p_momento)
       AND (aplic IS NULL OR jsonb_typeof(aplic) <> 'array' OR jsonb_array_length(aplic) = 0 OR aplic ? p_loja_id::text) THEN
      cid_c := (c->>'valor')::numeric; o_c := CASE WHEN g_c > 0 THEN 'Global+cidade' ELSE 'cidade' END;
    END IF;
    IF public.pd_ativo(ce->>'valor', ce->>'ativado_em', p_momento) THEN
      cid_e := (ce->>'valor')::numeric; o_e := CASE WHEN g_e > 0 THEN 'Global+cidade' ELSE 'cidade' END;
    END IF;
  END IF;
  RETURN jsonb_build_object('cliente', g_c + cid_c, 'entregador', g_e + cid_e, 'origem_cliente', o_c, 'origem_entregador', o_e);
END $$;

-- valor > 0 e ativado há menos de 120 min (horário sem fuso = UTC)
CREATE OR REPLACE FUNCTION public.pd_ativo(p_valor text, p_ativado text, p_momento timestamptz) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v numeric; t timestamptz;
BEGIN
  BEGIN v := nullif(p_valor, '')::numeric; EXCEPTION WHEN others THEN RETURN false; END;
  IF coalesce(v, 0) <= 0 OR nullif(p_ativado, '') IS NULL THEN RETURN false; END IF;
  BEGIN
    t := CASE WHEN p_ativado ~ '(Z|[+-][0-9]{2}:?[0-9]{2})$' THEN p_ativado::timestamptz ELSE (p_ativado || 'Z')::timestamptz END;
  EXCEPTION WHEN others THEN RETURN false; END;
  RETURN t + interval '120 minutes' > p_momento;
END $$;

GRANT EXECUTE ON FUNCTION public.preco_dinamico_vigente(uuid, timestamptz) TO anon, authenticated, service_role;

-- API Open Delivery: soma o dinâmico na criação (taxa e pagamento ao entregador)
CREATE OR REPLACE FUNCTION public.od_criar_entrega(p_credencial_id uuid, p_loja_id uuid, p_body jsonb, p_distancia_km numeric, p_fator_reta numeric, p_ip text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b jsonb := coalesce(p_body, '{}'::jsonb);
  v_order text := left(nullif(trim(b->>'orderId'), ''), 100);
  v_display text := left(nullif(trim(b->>'orderDisplayId'), ''), 50);
  da jsonb := b->'deliveryAddress';
  v_lat numeric; v_lng numeric; v_km numeric; v_tipos jsonb;
  l record; c record; v_existente record; v_hoje int;
  v_taxa numeric; v_taxa_moto numeric; v_agora timestamp := (now() AT TIME ZONE 'America/Sao_Paulo');
  v_delivery uuid := gen_random_uuid(); v_endereco text; v_res jsonb;
  v_tab_cob uuid; v_tab_pag uuid; v_teste boolean; v_pd jsonb;
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
      -- preço dinâmico: MESMA regra do painel (preco_dinamico_vigente), congelado aqui
      v_pd := public.preco_dinamico_vigente(p_loja_id, now());
      v_taxa := od_valor_faixa(v_tab_cob, v_km, false) + coalesce((v_pd->>'cliente')::numeric, 0);
      v_taxa_moto := od_valor_faixa(v_tab_pag, v_km, false) + coalesce((v_pd->>'entregador')::numeric, 0);
      v_endereco := concat_ws(', ', nullif(trim(concat_ws(' ', da->>'street', da->>'number')), ''), nullif(da->>'complement', ''),
                              nullif(da->>'district', ''), nullif(concat_ws(' - ', da->>'city', da->>'state'), ''));
      INSERT INTO public.pedidos (
        numero, numero_loja, endereco, valor, descricao, cliente, telefone, gorjeta, status, status_detalhado, origem,
        loja_id, latitude, longitude, endereco_coleta, latitude_coleta, longitude_coleta, contato_coleta,
        distancia_km, taxa_entrega, taxa_motoboy, taxa_entrega_motoboy, pontos, pontos_base, com_retorno, retirada,
        pagamento_confirmado, recebido_em, pronto_em, created_at, updated_at,
        od_order_id, od_delivery_id, od_credencial_id, od_teste, preco_dinamico, preco_dinamico_origem)
      VALUES (
        v_display, v_display, v_endereco, 0, left(b->>'specialInstructions', 500), left(b->>'customerName', 120),
        left(b->>'customerPhone', 30), 0,
        CASE WHEN v_teste THEN 'recebido' ELSE 'pronto' END, CASE WHEN v_teste THEN 'recebido' ELSE 'pronto' END, 'open_delivery',
        p_loja_id, v_lat, v_lng, l.endereco, l.latitude, l.longitude, l.nome,
        round(v_km, 2), v_taxa, v_taxa_moto, v_taxa_moto, coalesce(l.pontos_padrao, 4), coalesce(l.pontos_padrao, 4), false, false,
        true, CASE WHEN v_teste THEN NULL ELSE v_agora END, CASE WHEN v_teste THEN NULL ELSE v_agora END, v_agora, v_agora,
        v_order, v_delivery, p_credencial_id, v_teste,
        nullif(coalesce((v_pd->>'cliente')::numeric, 0), 0), v_pd->>'origem_cliente')
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
END $function$;

-- deliveryPrice (Open Delivery): valor CONGELADO do pedido na consulta de status
-- e no webhook. price = taxa_entrega gravada; pricingList DYNAMIC quando houve
-- preço dinâmico; additionalPricePercentual = dinâmico / preço de lista x 100.
CREATE OR REPLACE FUNCTION public.od_delivery_price(p_taxa numeric, p_pd numeric) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'price', jsonb_build_object('value', round(coalesce(p_taxa, 0), 2), 'currency', 'BRL'),
    'pricingList', CASE WHEN coalesce(p_pd, 0) > 0 THEN 'DYNAMIC' ELSE 'NORMAL' END,
    'additionalPricePercentual', CASE WHEN coalesce(p_pd, 0) > 0 AND coalesce(p_taxa, 0) - p_pd > 0
                                      THEN round(p_pd / (p_taxa - p_pd) * 100, 2) ELSE 0 END);
$$;

CREATE OR REPLACE FUNCTION public.od_consultar_entrega(p_credencial_id uuid, p_loja_id uuid, p_order_id text, p_ip text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'deliveryPrice', public.od_delivery_price(p.taxa_entrega, p.preco_dinamico),
      'deliveryPerson', CASE WHEN e.id IS NOT NULL THEN jsonb_build_object('id', e.id, 'name', e.nome, 'phone', e.telefone) END)));
  END IF;
  INSERT INTO public.od_acessos (credencial_id, loja_id, rota, metodo, http_status, ip, detalhe)
  VALUES (p_credencial_id, p_loja_id, '/v1/logistics/delivery/{orderId}', 'GET', (v_res->>'status')::int, nullif(left(p_ip, 64), ''),
          left('orderId=' || coalesce(p_order_id, '-'), 200));
  RETURN v_res;
END $function$;

CREATE OR REPLACE FUNCTION public.od_payload_evento(p pedidos, p_evento text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'deliveryPrice', public.od_delivery_price(p.taxa_entrega, p.preco_dinamico),
    'deliveryPerson', CASE WHEN e.id IS NOT NULL THEN jsonb_build_object('id', e.id, 'name', e.nome, 'phone', e.telefone) END));
END $function$;
COMMIT;
