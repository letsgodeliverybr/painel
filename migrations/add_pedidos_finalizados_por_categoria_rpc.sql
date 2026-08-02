-- Tela "Métricas Let's Go" — Pedidos Finalizados por Categoria (segundo
-- gráfico de pizza/donut, ao lado de "Lojas por Categoria").
--
-- Diferente de lojas_por_categoria (que é foto do total atual, sem
-- filtro de data), este SIM considera o período selecionado no DE/ATÉ do
-- topo da tela — mesmo comportamento dos outros gráficos que respeitam o
-- filtro (Pedidos Finalizados por Mês, Lojas Novas, Motoboys Novos).
--
-- pedidos.finalizado_em é `timestamp` SEM fuso, valor já em hora local de
-- Brasília (mesma causa raiz do bug de fuso já corrigido em várias telas
-- do painel — ver comentário de cabeçalho perto de _inicioDiaBrasilia em
-- app.js) — data_ini_local/data_fim_local são `timestamp` puro, comparados
-- direto contra finalizado_em, sem AT TIME ZONE/conversão nenhuma.
--
-- Status: mesmo critério de getStatusKey()/pedidos_finalizados_por_mes
-- (status_detalhado OU status, NULLIF trata string vazia como falsy igual
-- o || do JS).
--
-- LEFT JOIN com lojas (não INNER) — um pedido finalizado sem loja_id
-- válido não deve simplesmente sumir do total do gráfico; cai em "Sem
-- categoria" junto com lojas que não foram classificadas ainda, mesmo
-- princípio de não esconder o que não se sabe usado no resto da tela.
--
-- Sem parâmetro de loja — agregado de toda a operação, só faz sentido pro
-- perfil adm (ver app.js).
CREATE OR REPLACE FUNCTION public.pedidos_finalizados_por_categoria(data_ini_local timestamp, data_fim_local timestamp)
 RETURNS TABLE(categoria text, quantidade bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT COALESCE(l.categoria, 'Sem categoria') AS categoria, count(*) AS quantidade
  FROM public.pedidos p
  LEFT JOIN public.lojas l ON l.id = p.loja_id
  WHERE COALESCE(NULLIF(p.status_detalhado, ''), p.status) = 'finalizado'
    AND p.finalizado_em >= data_ini_local
    AND p.finalizado_em <= data_fim_local
  GROUP BY 1
  ORDER BY 2 DESC;
$function$;
