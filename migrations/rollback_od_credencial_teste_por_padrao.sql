-- Desfaz migrations/od_credencial_teste_por_padrao.sql: remove a trava e a
-- liberação de produção e volta as funções de criar/editar/listar da etapa 5.
-- Pedidos já gravados como teste continuam como teste.
BEGIN;
DROP TRIGGER IF EXISTS tg_od_pedido_teste_por_padrao ON public.pedidos;
DROP FUNCTION IF EXISTS public.fn_od_pedido_teste_por_padrao();
DROP FUNCTION IF EXISTS public.od_admin_liberar_producao(uuid);
CREATE OR REPLACE FUNCTION public.od_admin_listar_credenciais() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.od_admin_exigir();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'loja_id', c.loja_id, 'loja', l.nome, 'client_id', c.client_id, 'webhook_url', c.webhook_url,
      'parceiro_merchant_id', c.parceiro_merchant_id, 'parceiro_app_id', c.parceiro_app_id,
      'ativo', c.ativo AND c.revogado_em IS NULL, 'modo_teste', c.modo_teste,
      'limite_pedidos_dia', c.limite_pedidos_dia, 'limite_tokens_min', c.limite_tokens_min,
      'criado_em', c.criado_em, 'criado_por', c.criado_por, 'revogado_em', c.revogado_em, 'revogado_por', c.revogado_por)
      ORDER BY c.revogado_em NULLS FIRST, c.criado_em DESC)
    FROM public.od_credenciais c JOIN public.lojas l ON l.id = c.loja_id), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.od_admin_criar_credencial(
  p_loja_id uuid, p_webhook_url text, p_merchant_id text, p_app_id text, p_modo_teste boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb; v_quem text;
BEGIN
  PERFORM public.od_admin_exigir();
  IF nullif(p_webhook_url, '') IS NOT NULL AND NOT public.od_url_webhook_ok(p_webhook_url) THEN
    RAISE EXCEPTION USING MESSAGE = 'URL do webhook inválida: use https:// com domínio público.', HINT = 'url_invalida';
  END IF;
  IF (SELECT tipo_cobranca FROM public.lojas WHERE id = p_loja_id) IS DISTINCT FROM 'faturamento' THEN
    RAISE EXCEPTION USING MESSAGE = 'Por enquanto só lojas em faturamento podem usar o Open Delivery.', HINT = 'so_faturamento';
  END IF;
  SELECT coalesce(nome, email) INTO v_quem FROM public.usuarios_painel WHERE id = auth.uid();
  v := public.od_criar_credencial(p_loja_id, v_quem);
  UPDATE public.od_credenciais SET webhook_url = nullif(p_webhook_url, ''), parceiro_merchant_id = nullif(left(p_merchant_id, 100), ''),
         parceiro_app_id = nullif(left(p_app_id, 100), ''), modo_teste = coalesce(p_modo_teste, false)
   WHERE id = (v->>'credencial_id')::uuid;
  INSERT INTO public.logs_acoes (usuario_id, acao, detalhes)
  VALUES (auth.uid(), 'od_criar_credencial', jsonb_build_object('loja_id', p_loja_id, 'client_id', v->>'client_id', 'modo_teste', coalesce(p_modo_teste, false)));
  RETURN v;  -- {credencial_id, client_id, client_secret}
END $$;

CREATE OR REPLACE FUNCTION public.od_admin_atualizar_credencial(
  p_id uuid, p_webhook_url text, p_merchant_id text, p_app_id text, p_modo_teste boolean, p_limite_dia integer, p_limite_tokens integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.od_admin_exigir();
  IF nullif(p_webhook_url, '') IS NOT NULL AND NOT public.od_url_webhook_ok(p_webhook_url) THEN
    RAISE EXCEPTION USING MESSAGE = 'URL do webhook inválida: use https:// com domínio público.', HINT = 'url_invalida';
  END IF;
  UPDATE public.od_credenciais SET webhook_url = nullif(p_webhook_url, ''), parceiro_merchant_id = nullif(left(p_merchant_id, 100), ''),
         parceiro_app_id = nullif(left(p_app_id, 100), ''), modo_teste = coalesce(p_modo_teste, modo_teste),
         limite_pedidos_dia = coalesce(p_limite_dia, limite_pedidos_dia), limite_tokens_min = coalesce(p_limite_tokens, limite_tokens_min)
   WHERE id = p_id AND ativo AND revogado_em IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'Credencial não encontrada ou revogada.', HINT = 'nao_encontrada'; END IF;
  INSERT INTO public.logs_acoes (usuario_id, acao, detalhes)
  VALUES (auth.uid(), 'od_atualizar_credencial', jsonb_build_object('credencial_id', p_id, 'webhook_url', p_webhook_url,
          'modo_teste', p_modo_teste, 'limite_dia', p_limite_dia, 'limite_tokens', p_limite_tokens));
END $$;

ALTER TABLE public.od_credenciais DROP COLUMN IF EXISTS producao_liberada_por;
ALTER TABLE public.od_credenciais DROP COLUMN IF EXISTS producao_liberada_em;
COMMIT;
