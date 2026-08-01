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
-- BUG CORRIGIDO (encontrado em produção): a v1 desta função recebia
-- data_ini/data_fim como `date` puro e refazia a conversão de fuso dentro
-- do SQL (`created_at AT TIME ZONE 'America/Sao_Paulo' >= data_ini`), o que
-- divergia da forma como o resto do painel calcula os limites do período —
-- Relatório de Entregas (_buscarPedidosAdmin) e o card "Finalizados hoje"
-- (contadoresHoje, app.js) sempre usam _inicioDiaBrasilia/_fimDiaBrasilia,
-- que resolvem o boundary em JS pra um instante timestamptz absoluto
-- (`new Date(s+'T00:00:00-03:00').toISOString()`) ANTES de mandar pro
-- banco. Essa função agora recebe os mesmos timestamptz já resolvidos
-- (data_ini_ts/data_fim_ts) e só compara direto contra created_at, sem
-- recalcular fuso nenhum — garante os mesmos números que o Relatório de
-- Entregas pro mesmo período, sempre.
--
-- Mês ainda é truncado no fuso America/Sao_Paulo (só pra rotular a barra
-- com o mês local correto) — um pedido criado às 23h50 de Brasília no
-- último dia do mês não pode aparecer rotulado no mês seguinte só por
-- causa do UTC.
--
-- Status: mesmo critério de getStatusKey() em app.js (status_detalhado
-- OU status, tratando string vazia como "não informado" igual o operador
-- || do JS trata) — NULLIF evita que um status_detalhado='' (falsy em JS,
-- mas não NULL pro COALESCE puro) impeça a função de cair pro status.
--
-- loja_id_filtro é opcional: null (perfil adm) traz o agregado de todas as
-- lojas; com um id (perfil loja, ver _buscarMetricas em app.js) restringe
-- ao pedidos.loja_id daquela loja — mesmo campo usado em _lojaFiltro() pro
-- resto do painel.
DROP FUNCTION IF EXISTS public.pedidos_finalizados_por_mes(date, date, uuid);

CREATE OR REPLACE FUNCTION public.pedidos_finalizados_por_mes(data_ini_ts timestamptz, data_fim_ts timestamptz, loja_id_filtro uuid DEFAULT NULL)
 RETURNS TABLE(mes date, quantidade bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT
    date_trunc('month', p.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS mes,
    count(*) AS quantidade
  FROM public.pedidos p
  WHERE COALESCE(NULLIF(p.status_detalhado, ''), p.status) = 'finalizado'
    AND p.created_at >= data_ini_ts
    AND p.created_at <= data_fim_ts
    AND (loja_id_filtro IS NULL OR p.loja_id = loja_id_filtro)
  GROUP BY 1
  ORDER BY 1;
$function$;
