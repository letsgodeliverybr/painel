-- OPEN DELIVERY v1.7.1 — ETAPA 5 (tela de admin). PROPOSTA 2026-10-06, NÃO APLICADA.
-- Rollback: rollback_od_etapa5_admin.sql. Depende das etapas 1–4.
-- Funções chamadas pelo painel com a SESSÃO REAL do admin (Supabase Auth):
-- todas conferem od_eh_admin() — usuário ativo com perfil 'adm' em
-- usuarios_painel, pelo auth.uid() do token. A chave pública (anon) não chama
-- nenhuma. Cada ação grava em logs_acoes quem fez o quê (sem secret).
BEGIN;

CREATE OR REPLACE FUNCTION public.od_eh_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.usuarios_painel WHERE id = auth.uid() AND perfil = 'adm' AND ativo);
$$;

CREATE OR REPLACE FUNCTION public.od_admin_exigir() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.od_eh_admin() THEN
    RAISE EXCEPTION USING MESSAGE = 'Apenas administradores (com sessão ativa) podem fazer isso.', HINT = 'acesso_negado';
  END IF;
END $$;

-- Validação básica da URL ao salvar (a checagem completa anti-SSRF, com DNS, é feita no envio)
CREATE OR REPLACE FUNCTION public.od_url_webhook_ok(u text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT u ~ '^https://[A-Za-z0-9.-]+(:443)?(/[^\s]*)?$'
     AND lower(u) !~ '^https://(localhost|[^/]*\.local|[^/]*\.internal|metadata[^/]*)(/|:|$)'
     AND u !~ '^https://[0-9.]+(/|:|$)'           -- IP literal: só domínio
     AND length(u) <= 300;
$$;

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

-- Cria credencial e devolve o secret UMA vez (não é gravado em log)
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

-- Revogar: tokens param na hora; secret apagado do Vault; eventos pendentes descartados no próximo envio
CREATE OR REPLACE FUNCTION public.od_admin_revogar_credencial(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vault uuid; v_quem text;
BEGIN
  PERFORM public.od_admin_exigir();
  SELECT coalesce(nome, email) INTO v_quem FROM public.usuarios_painel WHERE id = auth.uid();
  UPDATE public.od_credenciais SET ativo = false, revogado_em = now(), revogado_por = v_quem
   WHERE id = p_id AND revogado_em IS NULL RETURNING secret_vault_id INTO v_vault;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'Credencial não encontrada ou já revogada.', HINT = 'nao_encontrada'; END IF;
  DELETE FROM vault.secrets WHERE id = v_vault;
  DELETE FROM public.od_tokens WHERE credencial_id = p_id;
  INSERT INTO public.logs_acoes (usuario_id, acao, detalhes) VALUES (auth.uid(), 'od_revogar_credencial', jsonb_build_object('credencial_id', p_id));
END $$;

CREATE OR REPLACE FUNCTION public.od_admin_listar_eventos(p_status text DEFAULT NULL, p_limite integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.od_admin_exigir();
  RETURN coalesce((SELECT jsonb_agg(x ORDER BY (x->>'id')::bigint DESC) FROM (
    SELECT jsonb_build_object('id', e.id, 'pedido', p.numero_loja, 'order_id', p.od_order_id, 'loja', l.nome, 'evento', e.evento,
      'seq', e.seq, 'status', e.status, 'tentativas', e.tentativas, 'ultimo_http', e.ultimo_http, 'ultimo_erro', e.ultimo_erro,
      'proxima_tentativa', e.proxima_tentativa, 'criado_em', e.criado_em, 'enviado_em', e.enviado_em, 'teste', p.od_teste) x
      FROM public.od_eventos e JOIN public.pedidos p ON p.id = e.pedido_id JOIN public.lojas l ON l.id = e.loja_id
     WHERE p_status IS NULL OR e.status = p_status
     ORDER BY e.id DESC LIMIT least(coalesce(p_limite, 100), 500)) s), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.od_admin_reenviar_evento(p_evento_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.od_admin_exigir();
  UPDATE public.od_eventos SET status = 'pendente', tentativas = 0, proxima_tentativa = now(), ultimo_erro = NULL
   WHERE id = p_evento_id AND status IN ('falhou', 'descartado');
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'Só eventos com falha ou descartados podem ser reenviados.', HINT = 'nao_reenviavel'; END IF;
  INSERT INTO public.logs_acoes (usuario_id, acao, detalhes) VALUES (auth.uid(), 'od_reenviar_evento', jsonb_build_object('evento_id', p_evento_id));
END $$;

REVOKE EXECUTE ON FUNCTION public.od_eh_admin(), public.od_admin_exigir(),
  public.od_admin_listar_credenciais(), public.od_admin_criar_credencial(uuid, text, text, text, boolean),
  public.od_admin_atualizar_credencial(uuid, text, text, text, boolean, integer, integer),
  public.od_admin_revogar_credencial(uuid), public.od_admin_listar_eventos(text, integer),
  public.od_admin_reenviar_evento(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.od_admin_listar_credenciais(), public.od_admin_criar_credencial(uuid, text, text, text, boolean),
  public.od_admin_atualizar_credencial(uuid, text, text, text, boolean, integer, integer),
  public.od_admin_revogar_credencial(uuid), public.od_admin_listar_eventos(text, integer),
  public.od_admin_reenviar_evento(bigint) TO authenticated;
COMMIT;
