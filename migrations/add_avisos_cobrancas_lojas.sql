-- Automação dos avisos de fatura (2026-09-14) — trava de bloqueio NÃO
-- reativada por decisão consciente do usuário (fase inicial da empresa);
-- isso é só pra automatizar os lembretes que hoje são disparados na mão
-- pelo admin. Timestamp em vez de boolean pra saber QUANDO cada aviso foi
-- enviado (auditoria), e pra ficar idempotente: o cron nunca reenvia pra
-- quem já tem o timestamp preenchido.
ALTER TABLE public.cobrancas_lojas
  ADD COLUMN IF NOT EXISTS aviso_vencimento_em timestamptz,
  ADD COLUMN IF NOT EXISTS aviso_vencido_em timestamptz;
