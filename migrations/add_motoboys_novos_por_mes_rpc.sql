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
-- Padrão em 2 passos — NÃO junta ADD COLUMN com DEFAULT now() na mesma
-- instrução. Isso já foi rodado errado uma vez direto em produção: como
-- now() é uma expressão volátil, "ADD COLUMN created_at DEFAULT now()"
-- força o Postgres a reescrever a tabela inteira e avaliar now() UMA VEZ
-- pra transação inteira, carimbando TODAS as linhas já existentes com o
-- mesmo timestamp (o momento do ALTER) — não deixa NULL como a intenção
-- original desta migration presumia. Resultado real: 89 entregadores
-- ficaram com created_at idêntico ao instante do ALTER, seria um pico
-- artificial de "cadastros novos" no gráfico. Corrigido manualmente em
-- produção (UPDATE zerando os timestamps duplicados — só sobra NULL nos
-- cadastros antigos, únicos e reais permanecem intactos).
--
-- ADD COLUMN sem default é rápido e só-metadados (não reescreve, não
-- toca nas linhas existentes — ficam NULL de verdade). SET DEFAULT depois
-- só afeta INSERTs futuros, nunca faz backfill.
ALTER TABLE public.entregadores ADD COLUMN IF NOT EXISTS created_at timestamp;
ALTER TABLE public.entregadores ALTER COLUMN created_at SET DEFAULT now();

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
