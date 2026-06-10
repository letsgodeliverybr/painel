-- Função RPC para excluir usuário do auth.users (libera CPF/email para reutilização).
-- SECURITY DEFINER faz a função rodar como o owner (postgres), que tem permissão na schema auth.
-- Execute no SQL Editor do Supabase Studio antes de usar a exclusão de entregadores.

CREATE OR REPLACE FUNCTION public.delete_auth_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;
