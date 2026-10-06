-- Open Delivery: credencial nasce SEMPRE em teste; produção só com liberação
-- explícita. PROPOSTA 2026-10-06, NÃO APLICADA. Rollback: rollback_od_credencial_teste_por_padrao.sql
-- Motivo: a credencial da @PEDELETSGO foi criada pela tela com modo_teste=false
-- (o registro da criação mostra que a função recebeu "false") e o pedido de
-- teste entrou como real, foi despachado e aceito.
-- 1) Coluna producao_liberada_em/por: só a função od_admin_liberar_producao
--    preenche (admin, registrada em logs_acoes).
-- 2) Trava no banco (gatilho em pedidos, antes de gravar): pedido Open
--    Delivery de credencial SEM produção liberada nasce como teste
--    (od_teste=true, status 'recebido', sem recebido_em/pronto_em) — não é
--    despachado nem cobrado, mesmo que modo_teste esteja desligado.
-- 3) Criar credencial: sempre modo_teste=true (o parâmetro deixa de valer).
-- 4) Editar: pode voltar para teste a qualquer momento; desligar o teste só
--    pela liberação de produção.
BEGIN;
ALTER TABLE public.od_credenciais ADD COLUMN IF NOT EXISTS producao_liberada_em timestamptz;
ALTER TABLE public.od_credenciais ADD COLUMN IF NOT EXISTS producao_liberada_por text;

CREATE OR REPLACE FUNCTION public.fn_od_pedido_teste_por_padrao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prod boolean;
BEGIN
  SELECT (NOT modo_teste) AND producao_liberada_em IS NOT NULL INTO v_prod
    FROM public.od_credenciais WHERE id = NEW.od_credencial_id;
  IF NOT coalesce(v_prod, false) THEN
    NEW.od_teste := true;
    IF NEW.status = 'pronto' THEN
      NEW.status := 'recebido'; NEW.status_detalhado := 'recebido';
    END IF;
    NEW.recebido_em := NULL; NEW.pronto_em := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_od_pedido_teste_por_padrao ON public.pedidos;
CREATE TRIGGER tg_od_pedido_teste_por_padrao BEFORE INSERT ON public.pedidos
  FOR EACH ROW WHEN (NEW.origem = 'open_delivery') EXECUTE FUNCTION public.fn_od_pedido_teste_por_padrao();

-- Criar: sempre em teste (p_modo_teste ignorado)
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
         parceiro_app_id = nullif(left(p_app_id, 100), ''), modo_teste = true
   WHERE id = (v->>'credencial_id')::uuid;
  INSERT INTO public.logs_acoes (usuario_id, acao, detalhes)
  VALUES (auth.uid(), 'od_criar_credencial', jsonb_build_object('loja_id', p_loja_id, 'client_id', v->>'client_id', 'modo_teste', true));
  RETURN v;
END $$;

-- Editar: modo_teste só pode ir para TRUE aqui (desligar = liberar produção)
CREATE OR REPLACE FUNCTION public.od_admin_atualizar_credencial(
  p_id uuid, p_webhook_url text, p_merchant_id text, p_app_id text, p_modo_teste boolean, p_limite_dia integer, p_limite_tokens integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.od_admin_exigir();
  IF nullif(p_webhook_url, '') IS NOT NULL AND NOT public.od_url_webhook_ok(p_webhook_url) THEN
    RAISE EXCEPTION USING MESSAGE = 'URL do webhook inválida: use https:// com domínio público.', HINT = 'url_invalida';
  END IF;
  UPDATE public.od_credenciais SET webhook_url = nullif(p_webhook_url, ''), parceiro_merchant_id = nullif(left(p_merchant_id, 100), ''),
         parceiro_app_id = nullif(left(p_app_id, 100), ''),
         modo_teste = CASE WHEN p_modo_teste THEN true ELSE modo_teste END,
         producao_liberada_em = CASE WHEN p_modo_teste THEN NULL ELSE producao_liberada_em END,
         limite_pedidos_dia = coalesce(p_limite_dia, limite_pedidos_dia), limite_tokens_min = coalesce(p_limite_tokens, limite_tokens_min)
   WHERE id = p_id AND ativo AND revogado_em IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'Credencial não encontrada ou revogada.', HINT = 'nao_encontrada'; END IF;
  INSERT INTO public.logs_acoes (usuario_id, acao, detalhes)
  VALUES (auth.uid(), 'od_atualizar_credencial', jsonb_build_object('credencial_id', p_id, 'webhook_url', p_webhook_url,
          'voltou_para_teste', coalesce(p_modo_teste, false), 'limite_dia', p_limite_dia, 'limite_tokens', p_limite_tokens));
END $$;

-- Liberar produção: única forma de desligar o modo teste
CREATE OR REPLACE FUNCTION public.od_admin_liberar_producao(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_quem text;
BEGIN
  PERFORM public.od_admin_exigir();
  SELECT coalesce(nome, email) INTO v_quem FROM public.usuarios_painel WHERE id = auth.uid();
  UPDATE public.od_credenciais SET modo_teste = false, producao_liberada_em = now(), producao_liberada_por = v_quem
   WHERE id = p_id AND ativo AND revogado_em IS NULL AND webhook_url IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'Credencial não encontrada, revogada ou sem webhook.', HINT = 'nao_liberavel'; END IF;
  INSERT INTO public.logs_acoes (usuario_id, acao, detalhes) VALUES (auth.uid(), 'od_liberar_producao', jsonb_build_object('credencial_id', p_id));
END $$;

-- Listagem passa a informar a liberação
CREATE OR REPLACE FUNCTION public.od_admin_listar_credenciais() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.od_admin_exigir();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'loja_id', c.loja_id, 'loja', l.nome, 'client_id', c.client_id, 'webhook_url', c.webhook_url,
      'parceiro_merchant_id', c.parceiro_merchant_id, 'parceiro_app_id', c.parceiro_app_id,
      'ativo', c.ativo AND c.revogado_em IS NULL,
      'modo_teste', c.modo_teste OR c.producao_liberada_em IS NULL,
      'producao_liberada_em', c.producao_liberada_em, 'producao_liberada_por', c.producao_liberada_por,
      'limite_pedidos_dia', c.limite_pedidos_dia, 'limite_tokens_min', c.limite_tokens_min,
      'criado_em', c.criado_em, 'criado_por', c.criado_por, 'revogado_em', c.revogado_em, 'revogado_por', c.revogado_por)
      ORDER BY c.revogado_em NULLS FIRST, c.criado_em DESC)
    FROM public.od_credenciais c JOIN public.lojas l ON l.id = c.loja_id), '[]'::jsonb);
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_od_pedido_teste_por_padrao(), public.od_admin_liberar_producao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.od_admin_liberar_producao(uuid) TO authenticated;
COMMIT;
