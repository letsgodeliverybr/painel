-- Bug real corrigido (2026-09-18, ver add_despacho_fila_exclusivo.sql):
-- a única mudança aqui é marcar exclusivo=true na linha que essa trigger
-- insere pra realocação manual — sem isso, a tela "Disponíveis" não
-- conseguia diferenciar essa linha (deve ficar exclusiva de quem foi
-- escolhido) de uma onda normal do modo Todos (deve aparecer pra
-- qualquer elegível via catch-up, mesmo quem perdeu a notificação
-- original) — as duas usavam onda=1, indistinguíveis sem essa coluna.
-- Resto da function é cópia exata da versão anterior, sem outra mudança.
create or replace function public.fn_intercept_realocacao_manual()
returns trigger
language plpgsql
as $function$
declare
  v_novo_courier uuid;
  v_antigo_courier uuid;
begin
  v_novo_courier := coalesce(NEW.entregador_id, NEW.motoboy_id);
  v_antigo_courier := coalesce(OLD.entregador_id, OLD.motoboy_id);

  if v_novo_courier is not null
     and v_novo_courier is distinct from v_antigo_courier
     and OLD.status is distinct from 'pronto'
     and OLD.status_detalhado is distinct from 'pronto'
  then
    insert into public.despacho_fila (pedido_id, entregador_id, status, onda, exclusivo, enviado_em, expira_em)
    values (NEW.id, v_novo_courier, 'aguardando', 1, true, now(), now() + interval '30 seconds');

    perform net.http_post(
      url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/notify-pedido-realocado',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', 'letsgo2026secret'
      ),
      body := jsonb_build_object(
        'entregador_id', v_novo_courier,
        'pedido_id', NEW.id,
        'numero', NEW.numero,
        'papel', 'novo'
      )
    );

    if v_antigo_courier is not null then
      perform net.http_post(
        url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/notify-pedido-realocado',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', 'letsgo2026secret'
        ),
        body := jsonb_build_object(
          'entregador_id', v_antigo_courier,
          'pedido_id', NEW.id,
          'numero', NEW.numero,
          'papel', 'antigo'
        )
      );
    end if;

    NEW.status := 'pronto';
    NEW.status_detalhado := 'pronto';
    NEW.motoboy_id := null;
    NEW.entregador_id := null;
  end if;

  return NEW;
end;
$function$;
