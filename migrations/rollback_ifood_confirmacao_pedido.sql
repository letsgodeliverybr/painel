-- Desfaz migrations/ifood_confirmacao_pedido.sql. Publicar antes as
-- versões anteriores de ifood-polling, ifood-status-sync e
-- ifood-validar-codigo (elas não leem essa coluna).
alter table public.pedidos
  drop column if exists ifood_confirmado_em;
