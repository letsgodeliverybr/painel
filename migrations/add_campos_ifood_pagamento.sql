-- Fase 1 do checklist de homologação iFood (item 4,5,6,7,8 — ver
-- levantamento 2026-09-07): mapearPedidoIfood() só extraía um subconjunto
-- pequeno do payload de /order/v1.0/orders/{id} — payments, benefits e o
-- documento do cliente já vêm na resposta e eram descartados. Campos
-- confirmados contra a doc pública do iFood (developer.ifood.com.br,
-- Order Details / Order events):
--   payments.methods[].method / .card.brand / .cash.changeFor
--   benefits[].value / .sponsorshipValues[]
--   customer.documentNumber / .documentType
-- `itens` (jsonb) já guarda o array bruto de items do iFood, que já inclui
-- "observations" por item — não precisa de coluna nova pra isso, só passar
-- a exibir no painel (ver app.js).
alter table public.pedidos
  add column if not exists bandeira_cartao text,
  add column if not exists troco_para numeric,
  add column if not exists cupom_valor numeric,
  add column if not exists cupom_detalhes jsonb,
  add column if not exists cliente_documento text;
