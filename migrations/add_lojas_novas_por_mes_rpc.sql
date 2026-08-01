-- Tela "Métricas Let's Go" — Lojas Novas por Mês (quantidade de lojas cujo
-- cadastro foi criado dentro de cada mês do período).
--
-- Mesmo padrão de pedidos_finalizados_por_mes: agregação COUNT+GROUP BY no
-- banco, nunca traz linha por loja pro client.
--
-- lojas.created_at é `timestamp` SEM fuso, valor já em hora local de
-- Brasília (confirmado via information_schema) — data_ini_local/
-- data_fim_local são `timestamp` puro, comparados direto, sem AT TIME
-- ZONE/conversão nenhuma (mesma causa raiz do bug de fuso já corrigido em
-- várias telas do painel).
--
-- Sem filtro de loja — não faz sentido escopar "lojas novas" a uma loja
-- específica, então essa tela só aparece pro perfil adm (ver app.js).
CREATE OR REPLACE FUNCTION public.lojas_novas_por_mes(data_ini_local timestamp, data_fim_local timestamp)
 RETURNS TABLE(mes date, novas bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT
    date_trunc('month', l.created_at)::date AS mes,
    count(*) AS novas
  FROM public.lojas l
  WHERE l.created_at >= data_ini_local
    AND l.created_at <= data_fim_local
  GROUP BY 1
  ORDER BY 1;
$function$;
