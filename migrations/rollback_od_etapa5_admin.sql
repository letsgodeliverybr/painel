-- Desfaz migrations/od_etapa5_admin.sql (só funções). Credenciais criadas pela
-- tela continuam (o rollback da etapa 1 apaga).
BEGIN;
DROP FUNCTION IF EXISTS public.od_admin_reenviar_evento(bigint);
DROP FUNCTION IF EXISTS public.od_admin_listar_eventos(text, integer);
DROP FUNCTION IF EXISTS public.od_admin_revogar_credencial(uuid);
DROP FUNCTION IF EXISTS public.od_admin_atualizar_credencial(uuid, text, text, text, boolean, integer, integer);
DROP FUNCTION IF EXISTS public.od_admin_criar_credencial(uuid, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.od_admin_listar_credenciais();
DROP FUNCTION IF EXISTS public.od_url_webhook_ok(text);
DROP FUNCTION IF EXISTS public.od_admin_exigir();
DROP FUNCTION IF EXISTS public.od_eh_admin();
COMMIT;
