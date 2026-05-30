-- Colunas para coleta em endereço externo e agendamento de pedidos

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS endereco_coleta text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS contato_coleta text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS telefone_coleta text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS agendado_para timestamptz;
