-- Tela "Métricas Let's Go" — segundo gráfico (pedidos cancelados por mês).
--
-- Mesmo padrão de pedidos_finalizados_por_mes (ver add_pedidos_finalizados_
-- por_mes_rpc.sql): agregação COUNT+GROUP BY no banco, nunca traz linha por
-- pedido pro client — evita o mesmo bug de limite de linhas do PostgREST
-- que já causou números errados no Relatório de Entregas.
--
-- pedidos.created_at é `timestamp` SEM fuso, valor já em hora local de
-- Brasília (confirmado via information_schema) — data_ini_local/
-- data_fim_local são `timestamp` puro, comparados direto, sem AT TIME
-- ZONE/conversão nenhuma (mesma causa raiz do bug de fuso já corrigido em
-- várias telas do painel).
--
-- Retorna cancelados E total de pedidos do mês juntos (não só cancelados)
-- pra dar pro client calcular a taxa de cancelamento (cancelados/total)
-- sem precisar de uma segunda query.
--
-- loja_id_filtro é opcional: null (perfil adm) traz o agregado de todas as
-- lojas; com um id (perfil loja) restringe ao pedidos.loja_id daquela loja
-- — mesmo campo usado em _lojaFiltro() pro resto do painel.
CREATE OR REPLACE FUNCTION public.pedidos_cancelados_por_mes(data_ini_local timestamp, data_fim_local timestamp, loja_id_filtro uuid DEFAULT NULL)
 RETURNS TABLE(mes date, cancelados bigint, total bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT
    date_trunc('month', p.created_at)::date AS mes,
    count(*) FILTER (WHERE COALESCE(NULLIF(p.status_detalhado, ''), p.status) = 'cancelado') AS cancelados,
    count(*) AS total
  FROM public.pedidos p
  WHERE p.created_at >= data_ini_local
    AND p.created_at <= data_fim_local
    AND (loja_id_filtro IS NULL OR p.loja_id = loja_id_filtro)
  GROUP BY 1
  ORDER BY 1;
$function$;
