-- Adiciona coluna cidade à tabela lojas e popula com base no sufixo do nome.
-- Execute no SQL Editor do Supabase Studio.

ALTER TABLE lojas ADD COLUMN IF NOT EXISTS cidade TEXT;

UPDATE lojas SET cidade = 'Ribeirão Preto' WHERE nome LIKE '%- RP%' OR nome LIKE '%-RP%';
UPDATE lojas SET cidade = 'São José dos Campos' WHERE nome LIKE '%- SJC%' OR nome LIKE '%-SJC%';
UPDATE lojas SET cidade = 'Campinas' WHERE nome LIKE '%- CAMPI%' OR nome LIKE '%-CAMPI%';
