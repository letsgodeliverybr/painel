-- Tela "Métricas Let's Go" — distribuição de Lojas por Categoria (gráfico
-- de pizza/donut). Diferente dos outros gráficos da tela, esse é uma foto
-- do total ATUAL — não recorta pelo filtro DE/ATÉ da tela (categoria de
-- negócio não muda com o tempo do jeito que "novos cadastros no mês"
-- muda; filtrar por created_at faria uma loja antiga sumir do gráfico só
-- por estar fora do período selecionado, o que não faz sentido pra essa
-- pergunta). Por isso a função não recebe parâmetro nenhum de data.
--
-- Lojas sem categoria (NULL — ainda não classificadas manualmente pela
-- interface) entram agrupadas como 'Sem categoria', em vez de somem do
-- gráfico ou contarem errado em outro grupo — mesmo princípio de não
-- esconder o que não se sabe usado no resto da tela de Métricas.
--
-- Sem filtro de loja — não há "minha categoria", só faz sentido pro
-- perfil adm (ver app.js).
CREATE OR REPLACE FUNCTION public.lojas_por_categoria()
 RETURNS TABLE(categoria text, quantidade bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT COALESCE(l.categoria, 'Sem categoria') AS categoria, count(*) AS quantidade
  FROM public.lojas l
  GROUP BY 1
  ORDER BY 2 DESC;
$function$;
