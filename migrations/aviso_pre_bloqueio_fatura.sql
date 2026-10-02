-- Aviso de pré-bloqueio por fatura em aberto (2026-10-02) — SÓ o aviso.
-- Parte da migrations/bloqueio_fatura_em_aberto.sql aplicada antes: funções de
-- vencimento e valor, isenção por loja, coluna aviso_pre_bloqueio_em e a função
-- da mensagem usada pelo cobranca-avisos (tipo 'pre_bloqueio', domingo 09:00).
-- NÃO cria o gatilho de bloqueio nem a checagem a cada 15 min — isso fica para
-- quando o bloqueio for aprovado (a migration completa é idempotente com esta).
-- Rollback: rollback_aviso_pre_bloqueio_fatura.sql

-- 3) vencimento = quarta da semana de geração (data de Brasília)
CREATE OR REPLACE FUNCTION public.fatura_vencimento(p_created_at timestamptz)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT d + CASE WHEN extract(dow FROM d)::int <= 3 THEN 3 - extract(dow FROM d)::int
                  ELSE 10 - extract(dow FROM d)::int END
    FROM (SELECT (p_created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d) x;
$$;

-- 4) valor atualizado (multa = maior entre 5% e R$ 5; juros 0,3%/dia corrido)
CREATE OR REPLACE FUNCTION public.fatura_valor_atualizado(p_valor numeric, p_venc date, p_hoje date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_hoje - p_venc <= 0 THEN round(p_valor, 2)
    ELSE round(p_valor + greatest(round(p_valor * 0.05, 2), 5) + round(p_valor * 0.003 * (p_hoje - p_venc), 2), 2) END;
$$;

-- isenção por loja (decisão de 2026-10-02: ACAI ATACADO fica fora do bloqueio
-- e do aviso de pré-bloqueio por enquanto). Usada pela mensagem abaixo.
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS bloqueio_fatura_isento boolean NOT NULL DEFAULT false;
UPDATE public.lojas SET bloqueio_fatura_isento = true WHERE id = 'db92832c-5a4e-4d7b-9b5c-62a9b6a0e261'; -- ACAI ATACADO - RP

-- 11) aviso de pré-bloqueio (domingo de manhã) — cobranca-avisos tipo 'pre_bloqueio'
ALTER TABLE public.cobrancas_lojas ADD COLUMN IF NOT EXISTS aviso_pre_bloqueio_em timestamptz;
CREATE OR REPLACE FUNCTION public.mensagem_pre_bloqueio_fatura(p_loja uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0; linhas text := ''; v_loja text;
BEGIN
  SELECT nome INTO v_loja FROM public.lojas WHERE id = p_loja AND tipo_cobranca = 'faturamento' AND NOT bloqueio_fatura_isento;
  IF NOT FOUND THEN RETURN NULL; END IF;  -- isenta ou não é de faturamento: sem aviso de bloqueio
  FOR r IN SELECT c.data_inicio, c.data_fim, public.fatura_vencimento(c.created_at) AS venc,
                  public.fatura_valor_atualizado(c.valor_total, public.fatura_vencimento(c.created_at)) AS valor
             FROM public.cobrancas_lojas c
            WHERE c.loja_id = p_loja AND c.status IN ('pendente','recusado')
              AND public.fatura_vencimento(c.created_at) < (now() AT TIME ZONE 'America/Sao_Paulo')::date
            ORDER BY c.created_at LOOP
    n := n + 1;
    linhas := linhas || format(E'\n• Período %s a %s — vencimento %s — R$ %s', to_char(r.data_inicio,'DD/MM'), to_char(r.data_fim,'DD/MM'),
              to_char(r.venc,'DD/MM'), translate(to_char(r.valor,'FM999,999,990.00'),',.','.,'));
  END LOOP;
  IF n = 0 THEN RETURN NULL; END IF;
  RETURN format(E'Olá, %s! 👋\n\n%s%s\n\nSe não houver pagamento até hoje, domingo, às 23:59, a criação de entregas fica bloqueada a partir de segunda-feira, até a regularização.\n\nLet''s Go Delivery',
    coalesce(v_loja,'loja'), CASE WHEN n = 1 THEN 'Sua fatura está em aberto:' ELSE 'Suas faturas estão em aberto:' END, linhas);
END;
$$;
