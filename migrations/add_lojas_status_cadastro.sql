-- Autocadastro público de lojas (mesmo conceito de "Em Análise" já usado
-- pra motoboy em entregadores.status_cadastro) — hoje toda loja cadastrada
-- pelo admin (criarLoja(), app.js) entra direto como ativa, sem nenhum
-- conceito de aprovação. Confirmado: nenhuma coluna equivalente existia.
--
-- Diferente de entregadores (que precisou de um trigger SECURITY DEFINER
-- em auth.users pra contornar RLS — ver fix_entregadores_signup_trigger.sql),
-- lojas e usuarios_painel não têm RLS habilitada hoje (Fase 1 foi
-- implementada e revertida por completo — ver commits daquela tentativa),
-- então um INSERT direto do client com a chave anon já funciona sem
-- precisar de trigger nenhum.
--
-- DEFAULT 'aprovado' (não 'pendente') de propósito: criarLoja() (fluxo do
-- admin) não seta status_cadastro — com esse default, toda loja criada
-- pelo admin continua saindo aprovada automaticamente, exatamente como já
-- se comporta hoje, sem precisar mudar aquele fluxo. Só o cadastro público
-- (novo, em app.js) seta status_cadastro='em_analise' explicitamente.
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS status_cadastro text DEFAULT 'aprovado';
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS motivo_reprovacao text;

-- Backfill: toda loja já existente foi criada pelo admin (direto ativa),
-- então conta como aprovada.
UPDATE public.lojas SET status_cadastro='aprovado' WHERE status_cadastro IS NULL;
