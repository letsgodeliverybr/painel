-- Aplica Tabela de Cobrança "TABELA NUVEM LET'S GO DELIVERY" e Tabela de
-- Pagamento "TABELA DE PAGAMENTO OFICIAL" em TODAS as lojas ativas do
-- sistema, sem exceção — inclusive as que já tinham outra tabela
-- deliberadamente selecionada (CONTRATO FIXO 100% DEMANDA, TABELA PREMIUM
-- 100% DEMANDA, TABELA DE PAGAMENTO PRÊMIUM) e as lojas de expansão
-- recém-importadas (Camarada Camarão nacional, farmácias do litoral de
-- SP) — confirmado explicitamente com o usuário, "sem exceção" mesmo.
--
-- 290 lojas ativas de 527 estavam divergentes de Nuvem/Oficial antes
-- desse update (163 com os dois campos nulos + 126 com cobrança
-- diferente + 1 com pagamento diferente, união = 290). Depois do UPDATE,
-- confirmado 527/527 ativas com Nuvem+Oficial, 0 divergentes restantes.
UPDATE public.lojas SET tabela_cobranca_id='a1e291f2-f815-4f67-86bf-cd4e95fb5fb6', updated_at=NOW()
WHERE ativo=true AND (tabela_cobranca_id IS NULL OR tabela_cobranca_id <> 'a1e291f2-f815-4f67-86bf-cd4e95fb5fb6');

UPDATE public.lojas SET tabela_pagamento_id='7bf1cf41-b3f2-4694-b326-d4e830dae8e1', updated_at=NOW()
WHERE ativo=true AND (tabela_pagamento_id IS NULL OR tabela_pagamento_id <> '7bf1cf41-b3f2-4694-b326-d4e830dae8e1');
