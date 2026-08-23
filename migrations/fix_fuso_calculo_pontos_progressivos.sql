-- congelar_pontos_aceite() calculava o atraso até o aceite com
-- `now() - NEW.pronto_em`. pronto_em é `timestamp` SEM fuso, gravado com
-- dígitos de horário LOCAL de Brasília (_agoraBrasilia() em app.js — mesma
-- convenção de todas as colunas timestamp sem fuso desse projeto). A sessão
-- do Postgres roda com TimeZone=UTC (confirmado via `show timezone`).
--
-- Nessa subtração, o Postgres precisa casar timestamptz (now()) com
-- timestamp (pronto_em) — não existe operador direto pra esse par, então
-- ele converte pronto_em pra timestamptz usando o TimeZone da sessão,
-- interpretando os dígitos LOCAIS como se já fossem UTC. Isso desloca
-- pronto_em ~3h pra trás no tempo absoluto, inflando o atraso calculado em
-- ~180 minutos sempre — não importa o atraso real. Confirmado com dado real
-- (só leitura, antes desta migration): pedido #5293, aceito em 10 segundos
-- reais, calculava 180+ minutos de atraso e caía sempre no teto de +700.
-- Efeito visível: pontos idênticos (704 = base 4 + 700) em entregas
-- completamente diferentes, tanto no painel quanto na tela "Aceitos" do
-- app Flutter (que já lê o campo certo, pedidos.pontos — o valor gravado é
-- que estava errado).
--
-- Fix: `now() AT TIME ZONE 'America/Sao_Paulo'` converte o instante atual
-- pra timestamp NAIVE com os dígitos de horário local de Brasília — mesma
-- convenção de pronto_em. Subtração naive-menos-naive dá o atraso real,
-- sem cast nenhum assumindo fuso errado. Testado com SELECT read-only
-- contra o pedido #5293 antes de aplicar: valor bateu certo.
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
    v_minutos := EXTRACT(EPOCH FROM ((now() AT TIME ZONE 'America/Sao_Paulo') - NEW.pronto_em)) / 60;
    IF v_minutos < 10 THEN
      NEW.pontos := v_base;
    ELSIF v_minutos < 20 THEN
      NEW.pontos := v_base + 150;
    ELSIF v_minutos < 30 THEN
      NEW.pontos := v_base + 300;
    ELSE
      NEW.pontos := v_base + 700;
    END IF;
  END IF;

  IF NEW.status = 'finalizado'
     AND OLD.status IS DISTINCT FROM 'finalizado'
     AND NEW.pontos IS NOT NULL THEN
    UPDATE public.entregadores
    SET pontos_semana = COALESCE(pontos_semana, 0) + NEW.pontos,
        pontos_total  = COALESCE(pontos_total, 0) + NEW.pontos
    WHERE id = COALESCE(NEW.motoboy_id, NEW.entregador_id);
  END IF;

  RETURN NEW;
END;
$$;
