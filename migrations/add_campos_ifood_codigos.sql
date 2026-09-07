-- Fase 5 do checklist de homologação iFood (achado durante a preparação
-- da Fase 4 — item 9 não era "não se aplica", era campo/endpoint
-- descartado). Confirmado contra a doc pública do iFood (2026-09-07):
--   GET /order/v1.0/orders/{id} já retorna "pickupCode" no payload
--     principal — nunca era lido por mapearPedidoIfood().
--   Evento DDCR (fullCode DELIVERY_DROP_CODE_REQUESTED) carrega o código
--     de confirmação de entrega em metadata.CODE — disparado só quando a
--     confirmação por código é obrigatória (telefone do cliente informado).
--   POST /order/v1.0/orders/{id}/validatePickupCode {code} valida o
--     código de coleta informado pelo motoboy.
--   POST /order/v1.0/orders/{id}/verifyDeliveryCode {code} valida o
--     código de entrega — o iFood marca o pedido CONCLUDED
--     automaticamente após validar (evento CON, já tratado desde a Fase 1).
-- Os dois "_validado_em" existem só pra a UI saber se já foi confirmado
-- (evita reenviar o mesmo código pro iFood à toa).
alter table public.pedidos
  add column if not exists ifood_pickup_code text,
  add column if not exists ifood_delivery_code text,
  add column if not exists ifood_pickup_validado_em timestamptz,
  add column if not exists ifood_entrega_validada_em timestamptz;
