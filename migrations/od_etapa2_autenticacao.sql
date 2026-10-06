-- OPEN DELIVERY v1.7.1 — ETAPA 2 (autenticação). PROPOSTA 2026-10-06, NÃO APLICADA.
-- Rollback: rollback_od_etapa2_autenticacao.sql. Depende da etapa 1.
-- Três funções, executáveis SÓ pela função de servidor (service_role):
--   od_criar_credencial  — gera client_id + secret (secret no Vault; devolvido UMA vez)
--   od_emitir_token      — /oauth/token: confere credencial, limite por minuto, grava hash do token
--   od_validar_token     — usada nas próximas etapas: token -> loja/credencial (nunca o corpo)
-- O secret e o token NUNCA são gravados em claro: só o Vault (cifrado) e hashes SHA-256.
-- Proteção contra quem chuta client_id/secret (sem depender da credencial):
--   • por IP: 10 falhas em 10 min -> 429 para aquele IP até a janela passar
--   • por client_id tentado: 10 falhas em 10 min -> 429 para aquele client_id
-- Só respostas 401 contam como falha (o próprio 429 não prolonga o bloqueio).
BEGIN;

ALTER TABLE public.od_acessos ADD COLUMN IF NOT EXISTS client_id_tentado text;
CREATE INDEX IF NOT EXISTS idx_od_acessos_ip_falha ON public.od_acessos (ip, criado_em) WHERE http_status = 401;
CREATE INDEX IF NOT EXISTS idx_od_acessos_client_falha ON public.od_acessos (client_id_tentado, criado_em) WHERE http_status = 401;

CREATE OR REPLACE FUNCTION public.od_criar_credencial(p_loja_id uuid, p_criado_por text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_client text; v_secret text; v_vault uuid; v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lojas WHERE id = p_loja_id) THEN
    RAISE EXCEPTION USING MESSAGE = 'Loja não encontrada.', HINT = 'loja_inexistente';
  END IF;
  IF EXISTS (SELECT 1 FROM public.od_credenciais WHERE loja_id = p_loja_id AND ativo AND revogado_em IS NULL) THEN
    RAISE EXCEPTION USING MESSAGE = 'A loja já tem credencial ativa. Revogue antes de criar outra.', HINT = 'credencial_ativa';
  END IF;
  v_client := 'lg_' || encode(gen_random_bytes(12), 'hex');
  v_secret := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_vault  := vault.create_secret(v_secret, 'od_secret_' || v_client, 'Open Delivery — secret da credencial ' || v_client);
  INSERT INTO public.od_credenciais (loja_id, client_id, secret_vault_id, secret_hash, criado_por)
  VALUES (p_loja_id, v_client, v_vault, encode(digest(v_secret, 'sha256'), 'hex'), left(p_criado_por, 120))
  RETURNING id INTO v_id;
  -- secret devolvido só aqui; não fica em log nenhum
  RETURN jsonb_build_object('credencial_id', v_id, 'client_id', v_client, 'client_secret', v_secret);
END $$;

CREATE OR REPLACE FUNCTION public.od_emitir_token(
  p_client_id text, p_secret_hash text, p_token_hash text, p_ip text, p_ttl_seg integer DEFAULT 3600)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_recentes int; v_ip text := nullif(left(coalesce(p_ip, ''), 64), ''); v_cli text := left(coalesce(p_client_id, ''), 100);
BEGIN
  IF (v_ip IS NOT NULL AND (SELECT count(*) FROM public.od_acessos WHERE ip = v_ip AND http_status = 401
        AND rota = '/oauth/token' AND criado_em > now() - interval '10 minutes') >= 10)
     OR (SELECT count(*) FROM public.od_acessos WHERE client_id_tentado = v_cli AND http_status = 401
        AND rota = '/oauth/token' AND criado_em > now() - interval '10 minutes') >= 10 THEN
    INSERT INTO public.od_acessos (rota, metodo, http_status, ip, client_id_tentado, detalhe)
    VALUES ('/oauth/token', 'POST', 429, v_ip, v_cli, 'bloqueio por tentativas falhas');
    RETURN jsonb_build_object('ok', false, 'status', 429);
  END IF;
  SELECT * INTO c FROM public.od_credenciais
   WHERE client_id = p_client_id AND ativo AND revogado_em IS NULL
   FOR UPDATE;                                         -- serializa o limite por credencial
  IF NOT FOUND OR c.secret_hash IS DISTINCT FROM p_secret_hash THEN
    INSERT INTO public.od_acessos (credencial_id, loja_id, rota, metodo, http_status, ip, client_id_tentado, detalhe)
    VALUES (c.id, c.loja_id, '/oauth/token', 'POST', 401, v_ip, v_cli, 'credencial inválida');
    RETURN jsonb_build_object('ok', false, 'status', 401);
  END IF;
  SELECT count(*) INTO v_recentes FROM public.od_tokens
   WHERE credencial_id = c.id AND criado_em > now() - interval '1 minute';
  IF v_recentes >= c.limite_tokens_min THEN
    INSERT INTO public.od_acessos (credencial_id, loja_id, rota, metodo, http_status, ip, detalhe)
    VALUES (c.id, c.loja_id, '/oauth/token', 'POST', 429, v_ip, 'limite de tokens por minuto');
    RETURN jsonb_build_object('ok', false, 'status', 429);
  END IF;
  DELETE FROM public.od_tokens WHERE credencial_id = c.id AND expira_em < now() - interval '1 day'; -- limpeza
  INSERT INTO public.od_tokens (token_hash, credencial_id, loja_id, expira_em)
  VALUES (p_token_hash, c.id, c.loja_id, now() + make_interval(secs => p_ttl_seg));
  INSERT INTO public.od_acessos (credencial_id, loja_id, rota, metodo, http_status, ip)
  VALUES (c.id, c.loja_id, '/oauth/token', 'POST', 200, v_ip);
  RETURN jsonb_build_object('ok', true, 'status', 200, 'expires_in', p_ttl_seg);
END $$;

-- Token -> loja. Credencial revogada derruba na hora todos os tokens dela.
CREATE OR REPLACE FUNCTION public.od_validar_token(p_token_hash text)
RETURNS TABLE (credencial_id uuid, loja_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.credencial_id, t.loja_id
    FROM public.od_tokens t JOIN public.od_credenciais c ON c.id = t.credencial_id
   WHERE t.token_hash = p_token_hash AND t.expira_em > now()
     AND c.ativo AND c.revogado_em IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.od_criar_credencial(uuid, text), public.od_emitir_token(text, text, text, text, integer),
  public.od_validar_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.od_criar_credencial(uuid, text), public.od_emitir_token(text, text, text, text, integer),
  public.od_validar_token(text) TO service_role;
COMMIT;
