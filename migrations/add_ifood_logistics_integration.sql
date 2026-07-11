-- Integração iFood Logistics (LetsGo como frota terceirizada para pedidos
-- feitos dentro do app iFood). Ver plano completo na conversa — resumo:
--
-- 1. ifood_order_id: chave de idempotência. O modelo de polling do iFood é
--    "at-least-once" (o mesmo evento pode chegar duplicado em retry/falha de
--    rede), e antes desta migração não existia NENHUMA coluna pra identificar
--    de qual pedido do iFood uma linha em `pedidos` veio — um evento
--    duplicado criaria um pedido duplicado. O insert do polling sempre usa
--    upsert (on conflict ifood_order_id do nothing).
--
-- 2. ifood_status_queue: fila local pro sync de status de volta pro iFood.
--    DELIBERADAMENTE não é um trigger que chama net.http_post direto —
--    depois de perder um dia inteiro hoje com falhas *silenciosas* de
--    trigger (schema errado em net.http_post, tipo errado no body, GUC não
--    configurada, CHECK constraint rejeitando valor), decidimos que nenhuma
--    chamada de rede deve acontecer de dentro de um trigger aqui. O trigger
--    só grava uma linha nesta fila (operação local, não falha por rede); uma
--    Edge Function separada (ifood-status-sync, rodando via cron) lê a fila
--    e faz a chamada HTTP de verdade, com retry e log de erro visível em
--    logs_acoes — nunca falha em silêncio.

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS ifood_order_id text UNIQUE;

CREATE TABLE IF NOT EXISTS public.ifood_status_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  evento text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'erro')),
  tentativas integer NOT NULL DEFAULT 0,
  erro text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  enviado_em timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ifood_status_queue_pendente
  ON public.ifood_status_queue (criado_em)
  WHERE status = 'pendente';

ALTER TABLE public.ifood_status_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permitir tudo ifood_status_queue" ON public.ifood_status_queue
  FOR ALL USING (true) WITH CHECK (true);

-- Mapeamento de status interno -> evento esperado pelo iFood Logistics.
-- 'finalizado' e 'cancelado' não geram evento aqui (arrivedAtDestination já
-- é o último evento de rastreamento relevante; cancelamento fica fora do
-- escopo inicial — a confirmar endpoint exato de cancelamento antes de
-- lidar com esse caso).
CREATE OR REPLACE FUNCTION public.fn_enfileirar_status_ifood()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  v_evento text;
BEGIN
  IF NEW.origem IS DISTINCT FROM 'ifood' OR NEW.ifood_order_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_evento := CASE NEW.status
    WHEN 'aceito' THEN 'goingToOrigin'
    WHEN 'chegou_local' THEN 'arrivedAtOrigin'
    WHEN 'em_rota' THEN 'dispatch'
    WHEN 'chegou_destino' THEN 'arrivedAtDestination'
    ELSE NULL
  END;

  IF v_evento IS NOT NULL THEN
    INSERT INTO public.ifood_status_queue (pedido_id, evento)
    VALUES (NEW.id, v_evento);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tg_enfileirar_status_ifood ON public.pedidos;

CREATE TRIGGER tg_enfileirar_status_ifood
  AFTER UPDATE OF status ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enfileirar_status_ifood();
