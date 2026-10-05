-- Retorno ao Saque Rápido: devolve ao CAIXA do Saque Rápido (configuracoes
-- chave 'caixa_saque_rapido') o total da última semana FECHADA = líquido pago
-- + lucro (taxas) dos saques rápidos pagos. PROPOSTA 2026-10-05, NÃO APLICADA.
-- Rollback: rollback_retorno_saque_rapido.sql
--
-- Semana: segunda 00:00 a domingo 23:59:59 em America/Sao_Paulo, pela data de
-- APROVAÇÃO (saques.aprovado_em, timestamptz = instante real). O corte é
-- calculado aqui no banco com o fuso de Brasília, nunca em UTC.
-- Mesma fonte da tela Saque Rápido: status 'pago' e chave_pix preenchida.
--
-- Uma linha por semana (PK semana_inicio) → impossível aprovar duas vezes.
-- Soma no caixa e grava a semana na MESMA transação, com o caixa travado
-- (FOR UPDATE): dois cliques ou duas abas não somam duas vezes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.saque_rapido_retornos (
  semana_inicio date PRIMARY KEY,           -- segunda
  semana_fim    date NOT NULL,              -- domingo
  qtd_saques    int     NOT NULL,
  valor_pago    numeric NOT NULL,           -- líquido pago aos entregadores
  valor_lucro   numeric NOT NULL,           -- taxas
  valor_total   numeric NOT NULL,           -- pago + lucro (somado ao caixa)
  caixa_antes   numeric NOT NULL,
  caixa_depois  numeric NOT NULL,
  devolvido_em  timestamptz NOT NULL DEFAULT now(),
  usuario       text,
  CHECK (extract(isodow FROM semana_inicio) = 1 AND semana_fim = semana_inicio + 6)
);
ALTER TABLE public.saque_rapido_retornos ENABLE ROW LEVEL SECURITY;
-- leitura pelo painel; gravação só pela função abaixo
DROP POLICY IF EXISTS saque_rapido_retornos_leitura ON public.saque_rapido_retornos;
CREATE POLICY saque_rapido_retornos_leitura ON public.saque_rapido_retornos
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.aprovar_retorno_saque_rapido(p_semana_inicio date, p_usuario text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ini timestamptz; v_fim timestamptz; v_hoje date;
  v_qtd int; v_pago numeric; v_lucro numeric; v_total numeric;
  v_antes numeric; v_depois numeric; v_em timestamptz;
BEGIN
  IF p_semana_inicio IS NULL OR extract(isodow FROM p_semana_inicio) <> 1 THEN
    RAISE EXCEPTION USING MESSAGE = 'A semana precisa começar numa segunda-feira.', HINT = 'semana_invalida';
  END IF;
  v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  IF p_semana_inicio + 7 > v_hoje THEN
    RAISE EXCEPTION USING MESSAGE = 'Essa semana ainda não fechou (fecha domingo 23:59, horário de Brasília).', HINT = 'semana_aberta';
  END IF;
  -- limites da semana no fuso de Brasília
  v_ini := p_semana_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_fim := (p_semana_inicio + 7)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  -- trava o caixa (cria a chave se não existir)
  INSERT INTO public.configuracoes (chave, valor, created_at, updated_at)
  VALUES ('caixa_saque_rapido', '0', now(), now()) ON CONFLICT (chave) DO NOTHING;
  SELECT coalesce(nullif(valor, '')::numeric, 0) INTO v_antes
    FROM public.configuracoes WHERE chave = 'caixa_saque_rapido' FOR UPDATE;

  SELECT devolvido_em INTO v_em FROM public.saque_rapido_retornos WHERE semana_inicio = p_semana_inicio;
  IF FOUND THEN
    RAISE EXCEPTION USING MESSAGE = format('Essa semana já foi devolvida em %s.',
      to_char(v_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')), HINT = 'ja_devolvida';
  END IF;

  SELECT count(*), coalesce(round(sum(coalesce(valor_liquido, valor)), 2), 0), coalesce(round(sum(coalesce(taxa, 0)), 2), 0)
    INTO v_qtd, v_pago, v_lucro
    FROM public.saques
   WHERE status = 'pago' AND chave_pix IS NOT NULL
     AND aprovado_em >= v_ini AND aprovado_em < v_fim;
  IF v_qtd = 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'Nenhum saque rápido pago nessa semana.', HINT = 'nada_a_devolver';
  END IF;
  v_total := v_pago + v_lucro;
  v_depois := round(v_antes + v_total, 2);

  UPDATE public.configuracoes SET valor = v_depois::text, updated_at = now() WHERE chave = 'caixa_saque_rapido';
  INSERT INTO public.saque_rapido_retornos
    (semana_inicio, semana_fim, qtd_saques, valor_pago, valor_lucro, valor_total, caixa_antes, caixa_depois, usuario)
  VALUES (p_semana_inicio, p_semana_inicio + 6, v_qtd, v_pago, v_lucro, v_total, v_antes, v_depois, left(p_usuario, 120))
  RETURNING devolvido_em INTO v_em;

  RETURN jsonb_build_object('semana_inicio', p_semana_inicio, 'qtd', v_qtd, 'valor_pago', v_pago,
    'valor_lucro', v_lucro, 'valor_total', v_total, 'caixa_antes', v_antes, 'caixa_depois', v_depois, 'devolvido_em', v_em);
END $$;
REVOKE EXECUTE ON FUNCTION public.aprovar_retorno_saque_rapido(date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aprovar_retorno_saque_rapido(date, text) TO anon, authenticated;
COMMIT;
