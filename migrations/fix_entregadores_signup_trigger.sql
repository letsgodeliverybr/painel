-- Corrige o fluxo de cadastro de entregadores (app parceiro / motoboy).
--
-- Causa raiz (mesma já corrigida para clientes_app em
-- lets_go_food/supabase/migrations/20260701_fix_clientes_app_signup.sql):
-- quando a confirmação de e-mail está habilitada, auth.signUp() cria o usuário
-- em auth.users mas não retorna sessão ativa. O insert em entregadores feito
-- pelo client logo em seguida roda como anon (auth.uid() nulo) e é bloqueado
-- por RLS, deixando o usuário órfão em auth.users sem linha em entregadores.
-- As telas seguintes do app (cadastro_aprovacao_screen, login_screen) fazem
-- UPDATE em vez de INSERT/upsert, que não lança erro quando zero linhas
-- casam — então o app segue "normalmente" sem nunca ter persistido nada.
--
-- Execute no SQL Editor do Supabase Studio, nesta ordem (o arquivo já está
-- nessa ordem: coluna → trigger → backfill retroativo).

-- 1. Coluna email em entregadores (hoje não existia — causava o campo
--    E-mail vazio no modal "Editar Entregador" do painel).
ALTER TABLE public.entregadores ADD COLUMN IF NOT EXISTS email text;

-- Backfill do que já existe: entregadores.id é o mesmo id de auth.users
-- (contrato usado em todo o sistema — ver registro_screen.dart).
UPDATE public.entregadores e
SET email = u.email
FROM auth.users u
WHERE u.id = e.id AND e.email IS NULL;

-- 2. Trigger SECURITY DEFINER: cria a linha de entregadores no servidor,
--    sem depender de sessão/RLS do client. Só dispara quando o signup é
--    tageado como 'entregador' via metadata (registro_screen.dart precisa
--    passar data: {'origem': 'entregador', 'nome': ...}), pra não criar
--    linha de entregador pra toda conta nova do sistema (lojas, admins,
--    clientes do app, que também nascem em auth.users).
CREATE OR REPLACE FUNCTION public.handle_new_entregador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'origem' = 'entregador' THEN
    INSERT INTO public.entregadores (id, nome, email, status, aprovado, status_cadastro, updated_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'nome', ''),
      NEW.email,
      'inativo', false, 'pendente', now()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_entregadores ON auth.users;

CREATE TRIGGER on_auth_user_created_entregadores
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_entregador();

-- 3. Backfill retroativo (execução única): cria a linha de entregadores pras
--    contas que já existem hoje em auth.users sem linha correspondente e não
--    são usuário do painel nem cliente do app — presumidamente entregadores
--    que ficaram órfãos por esse bug antes da correção acima existir.
--    Sem nome/telefone/CPF (a pessoa completa isso de novo no app, a tela
--    cadastro_aprovacao_screen já faz isso), mas com id/email já vinculados
--    pra destravar o próximo login/cadastro delas. Idempotente (ON CONFLICT).
INSERT INTO public.entregadores (id, nome, email, status, aprovado, status_cadastro, updated_at)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'nome', ''),
  u.email,
  'inativo', false, 'pendente', now()
FROM auth.users u
WHERE lower(u.email) NOT IN (SELECT lower(email) FROM public.usuarios_painel WHERE email IS NOT NULL)
  AND u.id NOT IN (SELECT id FROM public.clientes_app)
  AND u.id NOT IN (SELECT id FROM public.entregadores)
ON CONFLICT (id) DO NOTHING;
