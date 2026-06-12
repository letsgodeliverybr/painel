-- Adiciona colunas JSONB para configuração de preço dinâmico por cidade.
-- Uma linha com chave='preco_dinamico_cidades' armazena as configurações de todas as cidades.
-- Execute no SQL Editor do Supabase Studio.

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS preco_dinamico_por_cidade jsonb DEFAULT '{}';
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS preco_dinamico_entregador_por_cidade jsonb DEFAULT '{}';
