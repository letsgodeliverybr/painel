-- Fase 2 do checklist de homologação iFood, item 14 (aceitar/rejeitar troca
-- de endereço do cliente). Campos confirmados contra a doc pública do
-- iFood (Shipping / "Entrega Fácil", 2026-09-07):
--   evento code "DAR" (fullCode DELIVERY_ADDRESS_CHANGE_REQUESTED) chega
--   via polling/webhook com metadata.address (streetName, streetNumber,
--   complement, reference, neighborhood, city, state, country,
--   coordinates{latitude,longitude}). Prazo pra aceitar/rejeitar: 15min
--   corridos a partir da solicitação (depois disso o iFood rejeita
--   automaticamente).
--
-- Guarda só o pedido pendente atual (um de cada vez, é como o fluxo do
-- iFood funciona) direto na linha do pedido — não precisa de tabela nova
-- pra isso, o painel já busca a linha do pedido de qualquer jeito.
alter table public.pedidos
  add column if not exists troca_endereco_novo jsonb,
  add column if not exists troca_endereco_solicitada_em timestamptz;
