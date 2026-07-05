-- Pontos progressivos por tempo sem alocação (Parte A).
--
-- pontos_base preserva o valor original/base do pedido (hoje sempre 4, mas
-- pode ser customizado de 1 a 20 na criação), separado do valor "ao vivo" em
-- pedidos.pontos, que o painel (processarPontosAutomaticos, a cada 60s)
-- sobrescreve progressivamente enquanto o pedido está 'pronto' e sem
-- motoboy/entregador alocado.
--
-- O congelamento no momento do aceite é feito aqui, via trigger — não no
-- painel nem no app entregador — porque o aceite acontece em pelo menos 4
-- lugares diferentes (3 telas do app entregador + alocação manual no painel).
-- Um trigger BEFORE UPDATE cobre todos os caminhos de uma vez, com o now() do
-- próprio Postgres (preciso, não depende do relógio de nenhum client).

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS pontos_base integer;
UPDATE public.pedidos SET pontos_base = pontos WHERE pontos_base IS NULL;

CREATE OR REPLACE FUNCTION public.congelar_pontos_aceite()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_minutos numeric;
  v_base int;
BEGIN
  -- só age na transição de "sem motoboy/entregador" pra "com motoboy/entregador"
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_congelar_pontos_aceite ON public.pedidos;

CREATE TRIGGER trg_congelar_pontos_aceite
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.congelar_pontos_aceite();
