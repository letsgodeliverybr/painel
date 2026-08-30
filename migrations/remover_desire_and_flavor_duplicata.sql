-- Remove mais 1 duplicata do lote de 204 lojas (mesmo padrão de
-- remover_duplicatas_lote_importado_204_lojas.sql), achada só depois
-- porque o nome é uma tradução em inglês do nome real, então não bateu
-- no critério de similaridade de nome usado na primeira varredura.
--
-- "DESIRE AND FLAVOR - RP" (nova, documento placeholder, sem pedido) é a
-- mesma loja que "DESEJO & SABOR - RP" (antiga, desejoesabor@letsgo.com.br,
-- 86 pedidos) — endereço idêntico: Av. Antônio Diederichsen, 523, Jd.
-- América. Mantém a antiga, remove a nova (com limpeza de conta: tinha
-- login já criado pelo script de geração das 204).
--
-- Aplicado via Management API — IDs abaixo já não existem mais, arquivo é
-- só histórico/auditoria.

DELETE FROM public.clientes_app WHERE id = '9500badf-60cd-46bb-a252-da698a62f873';
DELETE FROM auth.users WHERE id = '9500badf-60cd-46bb-a252-da698a62f873';
DELETE FROM public.usuarios_painel WHERE loja_id = 'fc37ad74-d086-4e1b-8264-9cacf6c13e89';
DELETE FROM public.lojas WHERE id = 'fc37ad74-d086-4e1b-8264-9cacf6c13e89' AND documento='00000000000000';
