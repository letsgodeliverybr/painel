-- Rollback de lojas_tipo_cobranca_default_credito.sql — volta o DEFAULT de
-- antes (confirmado no banco em 2026-09-29). Não altera nenhuma loja.
ALTER TABLE public.lojas ALTER COLUMN tipo_cobranca SET DEFAULT 'faturamento';
