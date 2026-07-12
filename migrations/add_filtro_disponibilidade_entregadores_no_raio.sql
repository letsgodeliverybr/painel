-- Regra de negócio faltando: um entregador com pedido em andamento (aceito,
-- a caminho da coleta, em rota, etc.) não deveria receber nova oferta de
-- despacho até finalizar a entrega atual. Não existia nenhum filtro pra
-- isso — `em_processo` parecia cumprir esse papel, mas na prática é só um
-- lock transitório usado durante a decisão de roteirização (marca true por
-- um instante, libera logo em seguida — ver app.js linhas ~6726-6739), não
-- reflete "está entregando agora".
--
-- Confirmado com dado real em produção: um entregador com 2 pedidos ativos
-- em status 'em_rota' simultaneamente aparecia com disponivel=true e
-- em_processo=false — ou seja, elegível pra uma terceira oferta enquanto
-- ainda estava entregando os outros dois.
--
-- Fix: entregadores_no_raio (usada por despacho-engine nos modos 'todos' e
-- 'ondas', e na rede de segurança pós-timeout) agora exclui quem tem
-- qualquer pedido em status de entrega em andamento.

CREATE OR REPLACE FUNCTION public.entregadores_no_raio(lat double precision, lng double precision, raio_km double precision)
 RETURNS TABLE(id uuid, nome text, distancia_km double precision)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    e.id,
    e.nome,
    (6371 * acos(
      cos(radians(lat)) * cos(radians(e.lat)) *
      cos(radians(e.lng) - radians(lng)) +
      sin(radians(lat)) * sin(radians(e.lat))
    )) AS distancia_km
  FROM entregadores e
  WHERE e.disponivel = true
    AND e.em_processo = false
    AND e.lat IS NOT NULL
    AND e.lng IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE (p.motoboy_id = e.id OR p.entregador_id = e.id)
        AND p.status IN ('aceito', 'no_local', 'chegou_local', 'em_rota', 'chegou_destino', 'retornando')
    )
    AND (6371 * acos(
      cos(radians(lat)) * cos(radians(e.lat)) *
      cos(radians(e.lng) - radians(lng)) +
      sin(radians(lat)) * sin(radians(e.lat))
    )) <= raio_km
  ORDER BY distancia_km ASC;
$function$;
