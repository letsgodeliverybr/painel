-- Seletor de entrega parceira "Sobre Demanda" (Uber + iFood Shipping),
-- pedido do usuário 2026-09-19. Mesmo padrão de colunas já usado pro Uber
-- (uber_quote_id/uber_status), espelhado aqui pro módulo Shipping do
-- iFood. ifood_shipping_status: cotado -> solicitado -> sucesso|falha|cancelado.
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS ifood_shipping_quote_id text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS ifood_shipping_status text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS ifood_shipping_preco numeric;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS ifood_shipping_atualizado_em timestamptz;
