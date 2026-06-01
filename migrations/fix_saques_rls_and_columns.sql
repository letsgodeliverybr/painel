-- 1. Liberar RLS na tabela saques (chave publishable do painel admin)
ALTER TABLE saques DISABLE ROW LEVEL SECURITY;

-- 2. Adicionar colunas para histórico de pagamentos gerados
ALTER TABLE saques ADD COLUMN IF NOT EXISTS qtd_pedidos integer;
ALTER TABLE saques ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE saques ADD COLUMN IF NOT EXISTS data_fim date;
