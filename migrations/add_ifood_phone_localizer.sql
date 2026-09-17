-- Captura customer.phone.localizer (e sua expiração) do payload do iFood
-- — código de 8 dígitos usado no portal oficial de confirmação de entrega
-- própria (confirmacao-entrega-propria.ifood.com.br), independente do
-- telefone do cliente ser real ou o 0800 genérico do sandbox (são campos
-- separados). Confirmado contra uma chamada real (2026-09-17, pedido
-- #9326): customer.phone.localizer presente mesmo com número genérico.
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS ifood_phone_localizer text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS ifood_phone_localizer_expiration timestamptz;
