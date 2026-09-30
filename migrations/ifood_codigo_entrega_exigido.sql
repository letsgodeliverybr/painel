-- Marca que o iFood exige código de confirmação na entrega (2026-09-30).
-- O evento DDCR (DELIVERY_DROP_CODE_REQUESTED) não traz o código: no
-- sandbox (#5952, #7940) veio só com id/code/fullCode/createdAt/orderId/
-- merchantId/salesChannel, sem metadata, 0,3s depois do /confirm. O código
-- fica com o cliente, que informa ao entregador na porta; o DDCR só avisa
-- que o pedido exige esse código. ifood_delivery_code (add_campos_ifood_codigos.sql)
-- continua existindo mas deixa de ser preenchido.
alter table public.pedidos
  add column if not exists ifood_codigo_entrega_exigido_em timestamptz;
