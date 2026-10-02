-- Desfaz migrations/aviso_pre_bloqueio_fatura.sql (rodar DEPOIS de voltar o
-- cobranca-avisos para a versão sem 'pre_bloqueio' e tirar o cron de domingo).
BEGIN;
SELECT cron.unschedule('cobranca-aviso-pre-bloqueio-dom-cron') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cobranca-aviso-pre-bloqueio-dom-cron');
DROP FUNCTION IF EXISTS public.mensagem_pre_bloqueio_fatura(uuid);
DROP FUNCTION IF EXISTS public.fatura_valor_atualizado(numeric, date, date);
DROP FUNCTION IF EXISTS public.fatura_vencimento(timestamptz);
ALTER TABLE public.cobrancas_lojas DROP COLUMN IF EXISTS aviso_pre_bloqueio_em;
ALTER TABLE public.lojas DROP COLUMN IF EXISTS bloqueio_fatura_isento;
COMMIT;
