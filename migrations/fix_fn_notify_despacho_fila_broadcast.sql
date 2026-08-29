-- fn_notify_despacho_fila() nunca tinha recebido o mesmo fix que sua função
-- irmã fn_notify_pedido_pronto recebeu em 09/07
-- (fix_fn_notify_pedido_pronto_broadcast.sql) — carregava os 3 mesmos bugs
-- desde sempre:
--
-- 1. `extensions.net.http_post(...)` — endereçamento de 3 partes inválido
--    (Postgres interpreta como "database.schema.função"; pg_net expõe a
--    função no schema `net`, não em `extensions.net`).
-- 2. `current_setting('app.notify_secret')` — GUC nunca configurado em
--    nenhum nível.
-- 3. `body := (...)::text` — net.http_post espera `body jsonb`, não text.
--
-- Efeito real, mais grave que na função irmã: esse trigger dispara toda vez
-- que o despacho-engine insere um entregador em despacho_fila (o caminho
-- automático de raio, já corrigido/validado antes). Sem EXCEPTION block, o
-- erro (GUC inexistente, avaliado antes mesmo de chegar no net.http_post)
-- propaga e reverte o INSERT inteiro — despacho_fila nunca fica populada
-- de verdade pelo despacho-engine, mesmo ele "logando sucesso" (o erro
-- volta pro cliente supabase-js como `error`, só logado via logErr(), não
-- lançado). Confirmado com teste real isolado (despacho_fila inserido à
-- mão, mirado num único entregador de teste): antes do fix, net._http_response
-- mostrava 401/timeout; depois do fix, {"sent":1,"total":1} com sucesso.
--
-- Bug separado, também corrigido aqui: `tipo` estava sempre hardcoded como
-- 'nova_rota', mesmo pra despacho de pedido avulso (sem rota_agrupada_id) —
-- o app mostrava o texto errado de notificação ("Nova Rota" em vez de
-- "Novo Pedido") mesmo quando não era uma rota agrupada de verdade.
CREATE OR REPLACE FUNCTION public.fn_notify_despacho_fila()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.status = 'aguardando' then
    perform net.http_post(
      url     := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/notify-novo-pedido',
      headers := jsonb_build_object(
                   'Content-Type',      'application/json',
                   'x-webhook-secret',  'letsgo2026secret'
                 ),
      body    := jsonb_build_object(
                   'tipo',          case when NEW.rota_agrupada_id is not null then 'nova_rota' else 'novo_pedido' end,
                   'entregador_id', NEW.entregador_id
                 )
    );
  end if;
  return NEW;
end;
$function$;
