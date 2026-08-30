-- "⭐ Pontos" deixa de ser digitado na hora de criar o pedido — vira uma
-- configuração POR LOJA (ponto de partida/piso), editável em Nova Loja/
-- Editar Loja. O crescimento de pontos ao longo do tempo (função
-- processarPontosAutomaticos, app.js) e o congelamento no aceite (trigger
-- congelar_pontos_aceite, ver add_trigger_congelar_pontos_aceite.sql)
-- continuam exatamente como já funcionam — só o valor inicial (pontos_base)
-- passa a vir daqui em vez de hardcoded 4.
--
-- DEFAULT 4 preenche automaticamente todas as lojas já existentes com 4
-- (Postgres materializa o default pra linhas existentes num ADD COLUMN
-- com default constante — não muda comportamento de ninguém até o admin
-- editar manualmente).
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS pontos_padrao integer NOT NULL DEFAULT 4;

COMMENT ON COLUMN public.lojas.pontos_padrao IS 'Ponto de partida (piso) dos pontos de um pedido novo dessa loja — usado como pontos_base ao criar pedido. Editável em Nova Loja/Editar Loja. O crescimento ao longo do tempo (processarPontosAutomaticos) e o congelamento no aceite continuam iguais, só o valor inicial muda.';
