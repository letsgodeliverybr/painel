-- Bug em produção: pedidos nunca saíam de "recebido" quando marcados "pronto"
-- via botão manual OU via job automático auto_pronto_pedidos() — o UPDATE
-- inteiro era revertido, silenciosamente, porque o trigger AFTER UPDATE
-- tg_pedido_pronto_notify -> fn_notify_pedido_pronto() lançava erro sempre
-- que não havia uma linha pendente em despacho_fila (ou seja, no fluxo
-- normal de "broadcast geral", que é o caminho usado por praticamente todo
-- pedido). Só não quebrava quando havia alocação manual prévia (que insere
-- em despacho_fila e faz a função retornar cedo, pulando o trecho com bug).
--
-- Três bugs empilhados na mesma chamada, todos causando o mesmo rollback:
--
-- 1. `extensions.net.http_post(...)` — endereçamento de 3 partes inválido
--    (Postgres interpreta como "database.schema.função"; pg_net expõe a
--    função no schema `net`, não em `extensions.net`). Erro:
--    "cross-database references are not implemented".
--
-- 2. `body := (...)::text` — net.http_post espera `body jsonb`, não text.
--    Erro: "function net.http_post(...) does not exist".
--
-- 3. `current_setting('app.notify_secret')` — esse GUC nunca foi configurado
--    em nenhum nível (database/role). Erro: "unrecognized configuration
--    parameter". Trocado pelo mesmo secret literal que o painel (app.js,
--    _notificarPedidoPronto) já usa com sucesso pra esse mesmo endpoint.
--
-- Confirmado via reprodução manual (select auto_pronto_pedidos(); direto no
-- banco) e via pedido de teste ponta-a-ponta: criação -> 1min -> pronto ->
-- push recebido no app do motoboy.

CREATE OR REPLACE FUNCTION public.fn_notify_pedido_pronto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.status = 'pronto' and (OLD.status is null or OLD.status <> 'pronto') then
    if exists (
      select 1 from public.despacho_fila
      where pedido_id = NEW.id and status = 'aguardando'
    ) then
      return NEW;
    end if;

    perform net.http_post(
      url     := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/notify-novo-pedido',
      headers := jsonb_build_object(
                   'Content-Type',      'application/json',
                   'x-webhook-secret',  'letsgo2026secret'
                 ),
      body    := jsonb_build_object(
                   'tipo',      'novo_pedido',
                   'pedido_id', NEW.id
                 )
    );
  end if;
  return NEW;
end;
$function$;
