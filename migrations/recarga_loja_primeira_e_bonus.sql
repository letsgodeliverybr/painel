-- Recarga de loja: 1ª recarga mínima de R$ 300 + bônus só nos 7 primeiros
-- dias úteis do mês — regras NO SERVIDOR (2026-09-29). NÃO APLICADA.
-- Rollback: rollback_recarga_loja_primeira_e_bonus.sql
--
-- Hoje: a loja escolhe um pacote só na tela (Pix estático) e o admin lança o
-- crédito à mão em creditos_lojas (POST direto, total já com bônus). Nada
-- no servidor valida valor mínimo nem bônus.
--
-- Depois:
--  • creditar_recarga_loja(): ÚNICO caminho pra lançar RECARGA e BÔNUS de
--    loja. Grava o valor pago (tipo credito, origem recarga) e, se couber, o
--    bônus em linha separada (tipo bonus) — o bônus é calculado AQUI.
--  • 1ª recarga (loja sem nenhuma recarga anterior) < R$ 300 → recusada.
--  • Bônus do pacote (tabela pacotes_recarga, espelho dos pacotes da tela,
--    mesmos valores) só se a DATA DO CRÉDITO (hoje em America/Sao_Paulo, no
--    momento em que o admin confirma) estiver entre o 1º e o 7º dia útil do
--    mês. Dia útil = seg–sex menos feriados (tabela feriados, editável).
--    Valor pago que não bate com nenhum pacote → sem bônus.
--  • Gatilho em creditos_lojas: recarga/bônus por fora da função → recusado.
--    Débito de entrega, estorno e ajuste manual continuam por POST direto.
--  • Créditos já lançados NÃO mudam (só ganham a coluna origem, calculada).
BEGIN;

-- ── Feriados (lista editável) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feriados (
  data date PRIMARY KEY,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'nacional',            -- nacional | bancario | estadual | municipal
  conta_como_feriado boolean NOT NULL DEFAULT true, -- false = tratar como dia útil
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feriados_leitura ON public.feriados;
CREATE POLICY feriados_leitura ON public.feriados FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.feriados (data, descricao, tipo) VALUES
  ('2026-01-01', 'Confraternização Universal', 'nacional'),
  ('2026-02-16', 'Carnaval (segunda) — sem expediente bancário', 'bancario'),
  ('2026-02-17', 'Carnaval (terça) — sem expediente bancário', 'bancario'),
  ('2026-04-03', 'Sexta-feira Santa', 'nacional'),
  ('2026-04-21', 'Tiradentes', 'nacional'),
  ('2026-05-01', 'Dia do Trabalho', 'nacional'),
  ('2026-06-04', 'Corpus Christi — sem expediente bancário', 'bancario'),
  ('2026-09-07', 'Independência do Brasil', 'nacional'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2026-11-02', 'Finados', 'nacional'),
  ('2026-11-15', 'Proclamação da República', 'nacional'),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'),
  ('2026-12-25', 'Natal', 'nacional')
ON CONFLICT (data) DO NOTHING;

-- ── Pacotes (espelho de PACOTES_RECARGA_PIX do app.js — mesmos valores) ────
CREATE TABLE IF NOT EXISTS public.pacotes_recarga (
  pago numeric PRIMARY KEY,
  credito numeric NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);
ALTER TABLE public.pacotes_recarga ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pacotes_recarga_leitura ON public.pacotes_recarga;
CREATE POLICY pacotes_recarga_leitura ON public.pacotes_recarga FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.pacotes_recarga (pago, credito) VALUES
  (100, 100), (300, 300), (500, 550), (1000, 1200), (3000, 3750), (5000, 6500)
ON CONFLICT (pago) DO NOTHING;

-- ── creditos_lojas: origem de cada lançamento ──────────────────────────────
ALTER TABLE public.creditos_lojas ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE public.creditos_lojas ADD COLUMN IF NOT EXISTS criado_por text;
-- Classificação dos lançamentos antigos (só preenche a coluna nova; valor,
-- tipo e data não mudam). Crédito antigo que não é estorno conta como
-- recarga — loja que já recebeu crédito não é "primeira recarga".
UPDATE public.creditos_lojas SET origem = CASE
    WHEN tipo = 'debito' AND observacoes ILIKE 'entrega #%' THEN 'entrega'
    WHEN tipo = 'debito' THEN 'ajuste'
    WHEN observacoes ILIKE 'estorno #%' THEN 'estorno'
    ELSE 'recarga' END
  WHERE origem IS NULL;
CREATE INDEX IF NOT EXISTS idx_creditos_lojas_loja_origem ON public.creditos_lojas (loja_id, origem);

-- ── Dias úteis e janela do bônus ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hoje_brasilia() RETURNS date
LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

CREATE OR REPLACE FUNCTION public.eh_dia_util(p_dia date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT extract(isodow FROM p_dia) < 6
     AND NOT EXISTS (SELECT 1 FROM public.feriados f WHERE f.data = p_dia AND f.conta_como_feriado);
$$;

-- n-ésimo dia útil do mês de p_mes
CREATE OR REPLACE FUNCTION public.nesimo_dia_util(p_mes date, p_n int) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d::date FROM generate_series(date_trunc('month', p_mes), date_trunc('month', p_mes) + interval '1 month - 1 day', interval '1 day') d
   WHERE public.eh_dia_util(d::date) ORDER BY d OFFSET p_n - 1 LIMIT 1;
$$;

-- Janela = do 1º ao 7º dia útil do mês (inclusive; fim de semana/feriado no
-- meio da janela também vale). Fora dela, informa a próxima.
CREATE OR REPLACE FUNCTION public.janela_bonus_recarga(p_dia date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dia date := coalesce(p_dia, public.hoje_brasilia());
  v_ini date := public.nesimo_dia_util(v_dia, 1);
  v_fim date := public.nesimo_dia_util(v_dia, 7);
  v_ativo boolean := v_dia BETWEEN v_ini AND v_fim;
  v_prox date := CASE WHEN v_dia < v_ini THEN date_trunc('month', v_dia)::date
                      ELSE (date_trunc('month', v_dia) + interval '1 month')::date END;
BEGIN
  RETURN jsonb_build_object(
    'dia', v_dia, 'ativo', v_ativo, 'inicio', v_ini, 'fim', v_fim,
    'proximo_inicio', CASE WHEN v_ativo THEN NULL ELSE public.nesimo_dia_util(v_prox, 1) END,
    'proximo_fim',    CASE WHEN v_ativo THEN NULL ELSE public.nesimo_dia_util(v_prox, 7) END);
END $$;

CREATE OR REPLACE FUNCTION public.loja_ja_recarregou(p_loja_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.creditos_lojas c
                  WHERE c.loja_id = p_loja_id AND c.tipo = 'credito' AND c.origem = 'recarga');
$$;

-- Tudo que a tela da loja e o painel precisam mostrar (a tela só EXIBE).
CREATE OR REPLACE FUNCTION public.info_recarga_loja(p_loja_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'primeira_recarga', NOT public.loja_ja_recarregou(p_loja_id),
    'minimo_primeira_recarga', 300,
    'janela', public.janela_bonus_recarga(NULL),
    'pacotes', (SELECT jsonb_agg(jsonb_build_object('pago', pago, 'credito', credito) ORDER BY pago)
                  FROM public.pacotes_recarga WHERE ativo));
$$;

-- ── Lançamento de recarga (admin) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.creditar_recarga_loja(
  p_loja_id uuid, p_valor_pago numeric, p_usuario text, p_observacoes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hoje date := public.hoje_brasilia();
  v_primeira boolean;
  v_janela jsonb;
  v_credito_pacote numeric;
  v_bonus numeric := 0;
  v_obs text := nullif(trim(coalesce(p_observacoes, '')), '');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lojas WHERE id = p_loja_id) THEN
    RAISE EXCEPTION USING MESSAGE = 'Loja não encontrada.', HINT = 'loja_invalida';
  END IF;
  IF p_valor_pago IS NULL OR p_valor_pago <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'Informe o valor pago.', HINT = 'valor_invalido';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('recarga_loja:' || p_loja_id::text));

  v_primeira := NOT public.loja_ja_recarregou(p_loja_id);
  IF v_primeira AND p_valor_pago < 300 THEN
    RAISE EXCEPTION USING MESSAGE = 'Primeira recarga: o depósito mínimo é de R$ 300,00.', HINT = 'primeira_recarga_minima';
  END IF;

  v_janela := public.janela_bonus_recarga(v_hoje);
  SELECT credito INTO v_credito_pacote FROM public.pacotes_recarga WHERE pago = p_valor_pago AND ativo;
  IF (v_janela->>'ativo')::boolean AND v_credito_pacote > p_valor_pago THEN
    v_bonus := v_credito_pacote - p_valor_pago;
  END IF;

  PERFORM set_config('app.credito_recarga', '1', true);
  INSERT INTO public.creditos_lojas (loja_id, tipo, valor, observacoes, data, origem, criado_por, created_at, updated_at)
  VALUES (p_loja_id, 'credito', p_valor_pago,
          concat_ws(' — ', 'Recarga Pix R$ ' || to_char(p_valor_pago, 'FM999G990D00'), v_obs),
          v_hoje, 'recarga', left(p_usuario, 120), now(), now());
  IF v_bonus > 0 THEN
    INSERT INTO public.creditos_lojas (loja_id, tipo, valor, observacoes, data, origem, criado_por, created_at, updated_at)
    VALUES (p_loja_id, 'bonus', v_bonus,
            format('Bônus do pacote R$ %s (janela até %s)', to_char(p_valor_pago, 'FM999G990D00'), to_char((v_janela->>'fim')::date, 'DD/MM')),
            v_hoje, 'recarga', left(p_usuario, 120), now(), now());
  END IF;
  PERFORM set_config('app.credito_recarga', '', true);

  RETURN jsonb_build_object('primeira_recarga', v_primeira, 'valor_pago', p_valor_pago, 'bonus', v_bonus,
                            'credito_total', p_valor_pago + v_bonus, 'janela', v_janela);
END $$;

-- ── Gatilho: recarga/bônus só pela função ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_creditos_lojas_origem() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.origem IS NULL THEN
    NEW.origem := CASE
      WHEN NEW.tipo = 'debito' AND NEW.observacoes ILIKE 'entrega #%' THEN 'entrega'
      WHEN NEW.tipo = 'credito' AND NEW.observacoes ILIKE 'estorno #%' THEN 'estorno'
      ELSE 'ajuste' END;
  END IF;
  IF (NEW.origem = 'recarga' OR NEW.tipo = 'bonus')
     AND coalesce(current_setting('app.credito_recarga', true), '') <> '1' THEN
    RAISE EXCEPTION USING MESSAGE = 'Recarga e bônus de loja só podem ser lançados pela tela de recarga (creditar_recarga_loja).',
      HINT = 'recarga_so_pela_funcao';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_creditos_lojas_origem ON public.creditos_lojas;
CREATE TRIGGER tg_creditos_lojas_origem BEFORE INSERT ON public.creditos_lojas
  FOR EACH ROW EXECUTE FUNCTION public.fn_creditos_lojas_origem();

REVOKE EXECUTE ON FUNCTION public.fn_creditos_lojas_origem() FROM PUBLIC, anon, authenticated;
-- Painel (sem login real até a Fase 1) e loja chamam pela chave anon.
GRANT EXECUTE ON FUNCTION public.info_recarga_loja(uuid), public.janela_bonus_recarga(date),
  public.creditar_recarga_loja(uuid, numeric, text, text) TO anon, authenticated;

COMMIT;
