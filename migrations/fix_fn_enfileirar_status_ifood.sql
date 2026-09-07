-- Corrige o producer de ifood_status_queue (trigger tg_enfileirar_status_ifood
-- em pedidos, já existente — só a function estava com bugs reais):
--
-- 1. 'aceito' pulava direto pra 'goingToOrigin', sem nunca enfileirar
--    'assignDriver' antes. A doc da Logistics API do iFood lista os eventos
--    nessa ordem (assignDriver, goingToOrigin, arrivedAtOrigin, dispatch,
--    arrivedAtDestination) — assignDriver é quem informa o motoboy
--    designado; pular ele quebra a máquina de estado do lado do iFood.
--
-- 2. O CASE verificava NEW.status = 'chegou_local', mas o valor real
--    gravado (confirmado no código-fonte do app do entregador,
--    lib/screens/entrega_screen.dart) é 'no_local'. Esse branch nunca
--    batia — 'arrivedAtOrigin' nunca era enfileirado. Mantemos
--    'chegou_local'/'chegou_no_local' como sinônimos defensivos, já que o
--    projeto tem os três nomes espalhados em lugares diferentes
--    (status_utils.dart do app do entregador já faz esse mesmo tipo de
--    checagem dupla).
create or replace function public.fn_enfileirar_status_ifood()
returns trigger
language plpgsql
as $function$
begin
  if new.origem is distinct from 'ifood' or new.ifood_order_id is null then
    return new;
  end if;
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'aceito' then
    insert into public.ifood_status_queue (pedido_id, evento, criado_em)
      values (new.id, 'assignDriver', clock_timestamp());
    insert into public.ifood_status_queue (pedido_id, evento, criado_em)
      values (new.id, 'goingToOrigin', clock_timestamp());
  elsif new.status in ('no_local','chegou_local','chegou_no_local') then
    insert into public.ifood_status_queue (pedido_id, evento)
      values (new.id, 'arrivedAtOrigin');
  elsif new.status = 'em_rota' then
    insert into public.ifood_status_queue (pedido_id, evento)
      values (new.id, 'dispatch');
  elsif new.status = 'chegou_destino' then
    insert into public.ifood_status_queue (pedido_id, evento)
      values (new.id, 'arrivedAtDestination');
  end if;

  return new;
end;
$function$;
