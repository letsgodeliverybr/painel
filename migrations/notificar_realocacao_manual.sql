-- Complementa migrations/remove_triggers_notify_novo_pedido_duplicado.sql
-- (que removeu a única fonte de push desse caminho sem perceber, ver
-- NOTIFICACOES_MAPA.md seção 4/5). Adiciona a chamada de volta, agora pra
-- uma função dedicada (notify-pedido-realocado) — data-only, escopada só
-- a esse trigger, não um disparo genérico em despacho_fila (evita
-- reintroduzir a triplicação corrigida antes).
CREATE OR REPLACE FUNCTION public.fn_intercept_realocacao_manual()
RETURNS trigger AS $$
declare
  v_novo_courier uuid;
begin
  v_novo_courier := coalesce(NEW.entregador_id, NEW.motoboy_id);

  if v_novo_courier is not null
     and v_novo_courier is distinct from coalesce(OLD.entregador_id, OLD.motoboy_id)
     and OLD.status is distinct from 'pronto'
     and OLD.status_detalhado is distinct from 'pronto'
  then
    insert into public.despacho_fila (pedido_id, entregador_id, status, onda, enviado_em, expira_em)
    values (NEW.id, v_novo_courier, 'aguardando', 1, now(), now() + interval '30 seconds');

    perform net.http_post(
      url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/notify-pedido-realocado',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', 'letsgo2026secret'
      ),
      body := jsonb_build_object(
        'entregador_id', v_novo_courier,
        'pedido_id', NEW.id,
        'numero', NEW.numero
      )
    );

    NEW.status := 'pronto';
    NEW.status_detalhado := 'pronto';
    NEW.motoboy_id := null;
    NEW.entregador_id := null;
  end if;

  return NEW;
end;
$$ LANGUAGE plpgsql;
