-- PASSO 1 de 2 — fechar a leitura das senhas do painel pela chave pública.
-- PROPOSTA 2026-10-05, NÃO APLICADA. Inofensivo sozinho: só cria a função.
-- Rollback: rollback_fecha_senha_painel_passo1_login.sql
--
-- login_painel(e-mail, senha): confere a senha DENTRO do banco e devolve o
-- usuário SEM a coluna senha. Substitui o GET usuarios_painel?senha=eq.…
-- do login de produção (hostinger/index.html). Mesma regra de hoje:
-- e-mail + senha iguais e ativo=true. A senha continua como está gravada
-- (texto puro) — trocar por hash é um passo seguinte, separado.
BEGIN;
CREATE OR REPLACE FUNCTION public.login_painel(p_email text, p_senha text)
RETURNS TABLE (id uuid, email text, nome text, perfil text, loja_id uuid, ativo boolean, created_at timestamp)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email, u.nome, u.perfil, u.loja_id, u.ativo, u.created_at
    FROM public.usuarios_painel u
   WHERE u.email = p_email AND u.senha = p_senha AND u.ativo = true
     AND coalesce(p_senha, '') <> '';
$$;
REVOKE EXECUTE ON FUNCTION public.login_painel(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_painel(text, text) TO anon, authenticated;
COMMIT;
