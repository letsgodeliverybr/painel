-- Desfaz migrations/od_etapa3_entregas.sql (funções, cache de rota e as colunas
-- modo_teste/od_teste). ANTES, publicar o app.js sem o filtro od_teste. Pedidos já criados
-- pelo Open Delivery continuam existindo e seguem o fluxo normal.
BEGIN;
DROP FUNCTION IF EXISTS public.od_consultar_entrega(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.od_criar_entrega(uuid, uuid, jsonb, numeric, numeric, text);
DROP FUNCTION IF EXISTS public.od_resposta(int, text);
DROP FUNCTION IF EXISTS public.od_valor_faixa(uuid, numeric, boolean);
DROP FUNCTION IF EXISTS public.od_haversine_km(numeric, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.od_coordenada_valida(numeric, numeric);
DROP FUNCTION IF EXISTS public.od_iso_tz(timestamptz);
DROP FUNCTION IF EXISTS public.od_iso_brt(timestamp);
DROP FUNCTION IF EXISTS public.od_rota_cache_gravar(numeric, numeric, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.od_rota_cache_buscar(numeric, numeric, numeric, numeric);
DROP TABLE IF EXISTS public.od_rotas_cache;
ALTER TABLE public.pedidos DROP COLUMN IF EXISTS od_teste;         -- antes: rodar a limpeza dos pedidos de teste
ALTER TABLE public.od_credenciais DROP COLUMN IF EXISTS modo_teste;
COMMIT;
