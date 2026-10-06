-- Desfaz migrations/od_etapa2_autenticacao.sql (só as funções). Credenciais
-- e tokens já criados ficam nas tabelas da etapa 1 (o rollback dela apaga).
BEGIN;
DROP FUNCTION IF EXISTS public.od_validar_token(text);
DROP FUNCTION IF EXISTS public.od_emitir_token(text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.od_criar_credencial(uuid, text);
DROP INDEX IF EXISTS public.idx_od_acessos_ip_falha;
DROP INDEX IF EXISTS public.idx_od_acessos_client_falha;
ALTER TABLE public.od_acessos DROP COLUMN IF EXISTS client_id_tentado;
COMMIT;
