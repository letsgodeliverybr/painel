-- Desfaz migrations/od_etapa1_banco.sql. Apaga as tabelas do Open Delivery
-- (credenciais, tokens, fila, log) e as colunas od_* de pedidos.
-- Os secrets criados no Vault por credenciais (se houver) são removidos aqui.
-- Pedidos já criados pelo Open Delivery CONTINUAM existindo (só perdem o vínculo).
BEGIN;
DELETE FROM vault.secrets WHERE id IN (SELECT secret_vault_id FROM public.od_credenciais);
DROP INDEX IF EXISTS public.uq_pedidos_od_order_loja;
DROP INDEX IF EXISTS public.uq_pedidos_od_delivery;
ALTER TABLE public.pedidos DROP COLUMN IF EXISTS od_credencial_id;
ALTER TABLE public.pedidos DROP COLUMN IF EXISTS od_delivery_id;
ALTER TABLE public.pedidos DROP COLUMN IF EXISTS od_order_id;
DROP TABLE IF EXISTS public.od_acessos;
DROP TABLE IF EXISTS public.od_eventos;
DROP TABLE IF EXISTS public.od_tokens;
DROP TABLE IF EXISTS public.od_credenciais;
COMMIT;
