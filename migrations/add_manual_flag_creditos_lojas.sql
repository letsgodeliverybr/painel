-- Distingue lançamentos manuais do admin dos débitos automáticos de pedidos.
-- Após rodar, apenas registros com manual=true aparecem na aba Créditos do Financeiro.
-- Execute no SQL Editor do Supabase Studio.

ALTER TABLE creditos_lojas ADD COLUMN IF NOT EXISTS manual BOOLEAN DEFAULT FALSE;
