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
-- BUG CORRIGIDO DE VERDADE (v3, confirmado com dado real em produção):
-- public.pedidos.created_at é `timestamp without time zone` E o valor
-- gravado já É a hora local de Brasília (não UTC) — confirmado rodando
-- `pg_typeof(created_at)` e comparando um pedido às 22h34 de 31/07 (hora
-- local correta) contra o resultado de `created_at AT TIME ZONE
-- 'America/Sao_Paulo'`, que virou 01h34 de 01/08 (errado, +3h).
--
-- As v1 e v2 desta função (e a lógica de _inicioDiaBrasilia/
-- _fimDiaBrasilia usada pra montar os parâmetros) presumiam o oposto —
-- que created_at fosse um instante UTC real precisando de conversão de
-- fuso pra virar hora local. Aplicar AT TIME ZONE 'America/Sao_Paulo' (ou
-- comparar contra um parâmetro timestamptz, que força o Postgres a fazer
-- esse mesmo cast implícito via timezone da sessão) soma 3h que não
-- deveriam existir — pedidos criados entre ~21h e 23h59 de Brasília no
-- último dia do mês (ou do período) apareciam contados no mês seguinte.
--
-- Fix: zero conversão de fuso. data_ini/data_fim agora são `timestamp`
-- puro (mesma "hora de parede" que created_at já guarda) e o
-- date_trunc('month', ...) roda direto em cima de created_at, sem AT TIME
-- ZONE nenhum — a coluna já está no fuso certo, não precisa de tradução.
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
DROP FUNCTION IF EXISTS public.pedidos_finalizados_por_mes(timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.pedidos_finalizados_por_mes(data_ini_local timestamp, data_fim_local timestamp, loja_id_filtro uuid DEFAULT NULL)
 RETURNS TABLE(mes date, quantidade bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT
    date_trunc('month', p.created_at)::date AS mes,
    count(*) AS quantidade
  FROM public.pedidos p
  WHERE COALESCE(NULLIF(p.status_detalhado, ''), p.status) = 'finalizado'
    AND p.created_at >= data_ini_local
    AND p.created_at <= data_fim_local
    AND (loja_id_filtro IS NULL OR p.loja_id = loja_id_filtro)
  GROUP BY 1
  ORDER BY 1;
$function$;
