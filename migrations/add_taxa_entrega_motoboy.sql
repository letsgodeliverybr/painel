-- Adiciona coluna para armazenar o valor pago ao entregador por pedido
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS taxa_entrega_motoboy numeric;
