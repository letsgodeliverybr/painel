-- congelar_pontos_aceite() fazia duas coisas na MESMA transição (aceite:
-- motoboy_id/entregador_id NULL -> preenchido): congelava o VALOR do ponto
-- (correto, baseado no atraso até aquele momento) E já SOMAVA esse valor em
-- entregadores.pontos_semana/pontos_total — tudo no aceite, mesmo que a
-- entrega fosse cancelada ou reatribuída depois. Bug real confirmado em
-- produção: pedido #7795 (Gabriel Eliziário) está com status='cancelado' e
-- já tinha creditado 704 pontos pra ele mesmo assim.
--
-- Regra correta (confirmada com o usuário): o VALOR continua sendo
-- calculado e congelado no aceite (isso não muda) — só o CRÉDITO em
-- pontos_semana/pontos_total passa a acontecer na transição pra
-- status='finalizado', usando o valor já congelado. Cancelamento ou
-- reatribuição (que zera motoboy_id/entregador_id sem tocar em pontos, ver
-- marcarPedidoPronto em app.js) nunca chegam a creditar nada — e se
-- reatribuído, o próximo aceite recalcula pontos do zero a partir de
-- pontos_base, então o crédito na finalização sempre reflete quem
-- realmente entregou.
--
-- Verificado antes de aplicar: zero pedidos em andamento no momento desta
-- migration (todos já finalizados ou cancelados) — sem risco de contagem
-- em dobro na transição pra essa nova lógica.
CREATE OR REPLACE FUNCTION public.congelar_pontos_aceite()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_minutos numeric;
  v_base int;
BEGIN
  -- Congela o VALOR no aceite — só calcula, não credita ainda.
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

  -- Credita só quando a entrega finaliza de verdade — transição pra
  -- 'finalizado' (não dispara de novo em updates subsequentes já
  -- finalizados, nem em entregas canceladas ou reatribuídas).
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
