-- Desfaz o passo 1 (só a função). Antes, desfazer o passo 2 e voltar o login
-- da Hostinger para o GET antigo, senão o login de produção para.
BEGIN;
DROP FUNCTION IF EXISTS public.login_painel(text, text);
COMMIT;
