-- Desfaz migrations/estorno_diaria_ja_paga_30_09.sql (remove só esse débito).
DELETE FROM public.creditos_entregadores
 WHERE vaga_id = '8c405b4f-c286-40d3-aa8e-4f3e190426dc' AND tipo = 'debito' AND observacoes = 'Estorno De Diária - Já Paga';
