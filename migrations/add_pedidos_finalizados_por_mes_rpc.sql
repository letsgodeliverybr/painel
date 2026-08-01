-- Tela "Métricas Let's Go" (gráfico de pedidos finalizados por mês).
--
-- O Relatório de Entregas (_buscarPedidosAdmin, app.js) já teve um bug real:
-- a contagem vinha de um único SELECT com limit implícito, então períodos
-- com mais linhas que esse limite ficavam com números errados (cortados
-- numa janela dos mais recentes). Pra essa tela nova, em vez de trazer os
-- pedidos do período inteiro pro client e contar lá (o que reproduziria o
-- mesmo problema, já que fica sujeito ao limite de linhas do PostgREST),
-- a contagem é feita no banco via COUNT+GROUP BY mês — a função sempre
-- retorna no máximo 1 linha por mês do período, nunca 1 linha por pedido.
--
-- Mês é truncado no fuso America/Sao_Paulo pra bater com a mesma regra de
-- "dia/mês local" usada em todo o resto do painel (ver _dataHojeBrasilia,
-- _inicioDiaBrasilia em app.js) — um pedido criado às 23h50 de Brasília no
-- último dia do mês não pode cair no mês seguinte só por causa do UTC.
--
-- loja_id_filtro é opcional: null (perfil adm) traz o agregado de todas as
-- lojas; com um id (perfil loja, ver _buscarMetricas em app.js) restringe
-- ao pedidos.loja_id daquela loja — mesmo campo usado em _lojaFiltro() pro
-- resto do painel.
CREATE OR REPLACE FUNCTION public.pedidos_finalizados_por_mes(data_ini date, data_fim date, loja_id_filtro uuid DEFAULT NULL)
 RETURNS TABLE(mes date, quantidade bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT
    date_trunc('month', p.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS mes,
    count(*) AS quantidade
  FROM public.pedidos p
  WHERE COALESCE(p.status_detalhado, p.status) = 'finalizado'
    AND (p.created_at AT TIME ZONE 'America/Sao_Paulo') >= data_ini
    AND (p.created_at AT TIME ZONE 'America/Sao_Paulo') < (data_fim + 1)
    AND (loja_id_filtro IS NULL OR p.loja_id = loja_id_filtro)
  GROUP BY 1
  ORDER BY 1;
$function$;
