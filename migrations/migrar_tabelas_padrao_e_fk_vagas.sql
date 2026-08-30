-- Duas mudanças de dado/schema aplicadas juntas via Management API.
--
-- 1) Migra lojas com tabela_cobranca_id/tabela_pagamento_id nulos
--    ("Padrão do sistema", removido como opção do UI) pro valor real que
--    já era usado como fallback internamente (TABELA_COBRANCA_ID/
--    TABELA_PAGAMENTO_ID em app.js) — deixa explícito o que já era
--    verdade por baixo dos panos.
--    179 lojas tinham tabela_cobranca_id nulo, 182 tinham
--    tabela_pagamento_id nulo (união: 182 lojas afetadas, de 289 total).
UPDATE public.lojas SET tabela_cobranca_id='a1e291f2-f815-4f67-86bf-cd4e95fb5fb6', updated_at=NOW() WHERE tabela_cobranca_id IS NULL;
UPDATE public.lojas SET tabela_pagamento_id='7bf1cf41-b3f2-4694-b326-d4e830dae8e1', updated_at=NOW() WHERE tabela_pagamento_id IS NULL;

-- 2) Corrige bug real: vagas_motoboy_fixo nunca teve foreign keys, então o
--    app Flutter do entregador (que consulta com join embutido do
--    PostgREST: `select('*, lojas(nome,endereco,telefone)')`) sempre
--    recebia erro PGRST200 ("no relationship found"), capturado
--    silenciosamente e virando lista vazia — o entregador NUNCA via
--    nenhuma vaga fixa, mesmo com vagas reais disponíveis. O painel nunca
--    notou porque resolve o nome da loja no próprio JS, sem depender do
--    embed.
--    2 linhas órfãs (loja_id apontando pra uma loja já excluída,
--    status 'disponivel' com data já passada) removidas antes, senão
--    bloqueariam a criação da FK.
DELETE FROM public.vagas_motoboy_fixo
WHERE loja_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.lojas l WHERE l.id = vagas_motoboy_fixo.loja_id);

ALTER TABLE public.vagas_motoboy_fixo
  ADD CONSTRAINT vagas_motoboy_fixo_loja_id_fkey
  FOREIGN KEY (loja_id) REFERENCES public.lojas(id) ON DELETE SET NULL;

ALTER TABLE public.vagas_motoboy_fixo
  ADD CONSTRAINT vagas_motoboy_fixo_entregador_id_fkey
  FOREIGN KEY (entregador_id) REFERENCES public.entregadores(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
