-- Confirmação automática do pedido no iFood (2026-09-30). Investigação dos
-- pedidos de teste #6238/#8141/#1362: verifyDeliveryCode voltava 422
-- ORDER_NOT_AVAILABLE_FOR_HANDSHAKE ("Order didn't have confirmation from
-- merchant") e o iFood cancelava o pedido 8 minutos depois de criado —
-- nenhuma function chamava POST /order/v1.0/orders/{id}/confirm.
-- ifood_confirmado_em marca que o pedido já está confirmado no iFood, seja
-- pela nossa chamada a /confirm (ifood-polling / ifood-status-sync), seja
-- pelo evento CFM (aceite feito no Gestor de Pedidos do iFood). Com ela
-- preenchida, a confirmação automática não chama /confirm de novo.
alter table public.pedidos
  add column if not exists ifood_confirmado_em timestamptz;
