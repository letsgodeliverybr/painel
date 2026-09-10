-- Corrige bug real (2026-09-10): fn_intercept_realocacao_manual (migrations/
-- notificar_realocacao_manual.sql) sempre notificou só o entregador NOVO
-- quando um admin realoca manualmente um pedido já em andamento — o
-- entregador ANTIGO nunca era avisado que foi desalocado, continuava
-- "em rota" na visão dele enquanto o pedido já tinha voltado a 'pronto'
-- (disponível pra qualquer outro) no banco. Isso é exatamente o sintoma
-- relatado: pedido com entregador ativo aparecendo em "Disponíveis" nos
-- dois lados (painel e app do entregador) sem ninguém saber por quê.
--
-- Não é bug de filtro/query nenhum dos dois lados (investigado e
-- descartado) — o dado fica genuinamente consistente depois do trigger
-- reabrir o pedido, só falta avisar quem perdeu ele. Reaproveita a mesma
-- notify-pedido-realocado (edge function atualizada nesse commit pra
-- aceitar um campo "papel": 'novo'|'antigo', escolhendo o tipo de
-- notificação certo pra cada lado).
CREATE OR REPLACE FUNCTION public.fn_intercept_realocacao_manual()
RETURNS trigger AS $$
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
        'numero', NEW.numero,
        'papel', 'novo'
      )
    );

    -- NOVO (2026-09-10): avisa quem perdeu o pedido, não só quem ganhou.
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
$$ LANGUAGE plpgsql;
