-- Tela de acompanhamento da entrega Uber Direct no card do pedido admin
-- (pedido do usuário, 2026-09-18) — colunas pra guardar o último status
-- reportado pelos webhooks event.delivery_status/event.courier_update
-- (ver supabase/functions/uber-webhook/index.ts). uber_atualizado_em é
-- timestamptz de verdade (não segue o padrão *_naive do resto do projeto
-- porque é coluna nova, sem legado; grava o horário real UTC de quando
-- o evento chegou).
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uber_delivery_status text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uber_courier_nome text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uber_courier_telefone text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uber_courier_veiculo text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uber_courier_lat numeric;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uber_courier_lng numeric;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uber_atualizado_em timestamptz;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uber_evento_bruto jsonb;
