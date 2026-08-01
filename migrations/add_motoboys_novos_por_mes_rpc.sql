-- Tela "Métricas Let's Go" — Motoboys Novos por Mês.
--
-- entregadores não tinha nenhuma coluna confiável pra "data de cadastro"
-- (confirmado via information_schema — 46 colunas, nenhuma serve):
--   updated_at     — tocado a cada toggle Online/Offline e outras ações
--                    operacionais (ver dbPatch('entregadores',...) em
--                    app.js), não reflete o cadastro original.
--   data_nascimento — data de nascimento do entregador, não do cadastro.
--   aprovado        — boolean, sem timestamp de quando mudou.
--
-- DEFAULT now() só vale pra cadastros NOVOS a partir de agora — cadastros
-- já existentes ficam com created_at NULL de propósito, sem backfill
-- inventado. A RPC abaixo (WHERE created_at BETWEEN ...) exclui NULL
-- naturalmente, então meses anteriores a esta migration mostram 0 no
-- gráfico — não porque não houve cadastro naquele mês, mas porque não
-- existe essa data histórica confiável. A métrica só fica utilizável de
-- verdade a partir de quando essa coluna passou a existir.
ALTER TABLE public.entregadores ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();

-- Mesmo padrão de lojas_novas_por_mes/pedidos_finalizados_por_mes:
-- agregação COUNT+GROUP BY no banco, nunca traz linha por entregador pro
-- client. created_at é `timestamp` SEM fuso — data_ini_local/
-- data_fim_local também são `timestamp` puro, comparados direto, sem AT
-- TIME ZONE/conversão nenhuma (mesma causa raiz do bug de fuso já
-- corrigido em várias telas do painel).
--
-- Sem filtro de loja — "motoboys novos" é uma métrica da operação como um
-- todo, não de uma loja específica, então essa tela só aparece pro perfil
-- adm (ver app.js).
CREATE OR REPLACE FUNCTION public.motoboys_novos_por_mes(data_ini_local timestamp, data_fim_local timestamp)
 RETURNS TABLE(mes date, novos bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT
    date_trunc('month', e.created_at)::date AS mes,
    count(*) AS novos
  FROM public.entregadores e
  WHERE e.created_at >= data_ini_local
    AND e.created_at <= data_fim_local
  GROUP BY 1
  ORDER BY 1;
$function$;
