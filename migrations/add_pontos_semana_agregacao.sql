-- Agregação de pontos_semana/pontos_total + reset semanal via pg_cron.
--
-- entregadores.pontos_semana e pontos_total existiam na tabela mas nunca
-- eram alimentados por nenhum trigger, função ou job — por isso a tela
-- Ranking Entregador sempre mostrou 0 pra todo mundo, mesmo com entregadores
-- ativos. Esta migration:
--   1. estende congelar_pontos_aceite() (mesmo trigger BEFORE UPDATE em
--      pedidos, criado em add_pontos_progressivos.sql, que já congela
--      pedidos.pontos no momento do aceite) para também somar esse valor em
--      entregadores.pontos_semana e pontos_total do entregador correspondente.
--      Não precisa recriar o trigger em si — CREATE OR REPLACE FUNCTION já
--      atualiza o corpo que o trigger existente executa.
--   2. faz o backfill retroativo, agrupado por entregador, dos pedidos já
--      aceitos antes desta migration existir (bloco de rodar só uma vez —
--      ver aviso abaixo).
--   3. cria um job pg_cron que zera só pontos_semana (pontos_total é o
--      acumulado histórico e nunca zera) toda segunda-feira à meia-noite,
--      horário de Brasília. Brasil não observa mais horário de verão desde
--      2019, então meia-noite em Brasília = 03:00 UTC o ano todo.

CREATE OR REPLACE FUNCTION public.congelar_pontos_aceite()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_minutos numeric;
  v_base int;
BEGIN
  IF (OLD.motoboy_id IS NULL AND OLD.entregador_id IS NULL)
     AND (NEW.motoboy_id IS NOT NULL OR NEW.entregador_id IS NOT NULL)
     AND NEW.pronto_em IS NOT NULL THEN
    v_base := COALESCE(NEW.pontos_base, NEW.pontos, 4);
    v_minutos := EXTRACT(EPOCH FROM (now() - NEW.pronto_em)) / 60;
    IF v_minutos < 10 THEN
      NEW.pontos := v_base;
    ELSIF v_minutos < 20 THEN
      NEW.pontos := v_base + 150;
    ELSIF v_minutos < 30 THEN
      NEW.pontos := v_base + 300;
    ELSE
      NEW.pontos := v_base + 700;
    END IF;

    UPDATE public.entregadores
    SET pontos_semana = COALESCE(pontos_semana, 0) + NEW.pontos,
        pontos_total  = COALESCE(pontos_total, 0) + NEW.pontos
    WHERE id = COALESCE(NEW.motoboy_id, NEW.entregador_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill retroativo (RODAR SÓ UMA VEZ): soma os pontos de pedidos já
-- aceitos antes desta migration existir, agrupados por entregador.
--   pontos_total  recebe a soma de TODOS os pedidos já aceitos (histórico).
--   pontos_semana recebe só a soma dos pedidos aceitos a partir da segunda-
--                 feira da semana atual (mesmo corte de semana usado no
--                 painel, em _inicioSemanaAtualBrasilia()).
-- Esse bloco soma em cima do que já existe (COALESCE(...,0) + soma) — rodar
-- de novo depois de já ter sido aplicado conta os pedidos em dobro.
WITH aceitos AS (
  SELECT COALESCE(motoboy_id, entregador_id) AS entregador_id,
         pontos,
         created_at
  FROM public.pedidos
  WHERE (motoboy_id IS NOT NULL OR entregador_id IS NOT NULL)
    AND pontos IS NOT NULL
),
agregado AS (
  SELECT entregador_id,
         SUM(pontos) AS total,
         SUM(pontos) FILTER (
           WHERE created_at >= (date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
         ) AS semana
  FROM aceitos
  GROUP BY entregador_id
)
UPDATE public.entregadores e
SET pontos_total  = COALESCE(e.pontos_total, 0) + a.total,
    pontos_semana = COALESCE(e.pontos_semana, 0) + COALESCE(a.semana, 0)
FROM agregado a
WHERE e.id = a.entregador_id;

-- cron.schedule com um jobname que já existe atualiza o job em vez de
-- duplicar — seguro rodar essa migration mais de uma vez.
SELECT cron.schedule(
  'reset_pontos_semana',
  '0 3 * * 1',
  $$UPDATE public.entregadores SET pontos_semana = 0$$
);
