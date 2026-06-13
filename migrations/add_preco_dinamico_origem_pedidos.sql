-- Rastreia a origem do preço dinâmico aplicado no pedido.
-- 'global' = PD ativado globalmente (feriado/promoção para todas as cidades)
-- 'cidade' = PD ativado por cidade (ex: Ribeirão Preto)
-- NULL = pedido criado sem PD ativo ou antes dessa feature.
-- Execute no SQL Editor do Supabase Studio.

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS preco_dinamico_origem TEXT;
