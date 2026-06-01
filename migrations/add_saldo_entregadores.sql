-- Adiciona saldo acumulado do entregador (ganhos pendentes de saque)
ALTER TABLE entregadores ADD COLUMN IF NOT EXISTS saldo numeric DEFAULT 0;
