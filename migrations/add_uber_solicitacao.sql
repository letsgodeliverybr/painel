-- Suporte ao botão "Sobre Demanda" — solicitação de entregador via Uber
-- Direct API pra um pedido específico. uber_status registra o resultado
-- da última tentativa (útil pro badge do card e pra debug), sem impedir
-- nova tentativa se a anterior falhar.
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uber_delivery_id text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uber_tracking_url text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uber_quote_id text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uber_status text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uber_solicitado_em timestamptz;
