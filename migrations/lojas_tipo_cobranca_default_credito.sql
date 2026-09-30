-- Loja nova nasce PRÉ-PAGA (tipo_cobranca='credito') — 2026-09-29. NÃO APLICADA.
-- Só muda o DEFAULT da coluna (vale pra INSERT que não informa o campo:
-- edge functions, integrações, SQL manual). Nenhuma loja existente é
-- alterada. O painel (app.js) passa a gravar 'credito' explicitamente nos 3
-- caminhos de criação (autocadastro, Nova Loja, importação em massa).
-- Rollback: rollback_lojas_tipo_cobranca_default_credito.sql
ALTER TABLE public.lojas ALTER COLUMN tipo_cobranca SET DEFAULT 'credito';
