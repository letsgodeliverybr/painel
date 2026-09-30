-- Correção: valores nas observações da recarga saíam no formato do servidor
-- (lc_numeric = en_US → "R$ 1,234.50"). Passa a "R$ 1.234,50", independente
-- da configuração. Só troca o corpo de creditar_recarga_loja (mesma assinatura,
-- mesmas regras). NÃO APLICADA. Rollback: reaplicar o bloco da função em
-- recarga_loja_primeira_e_bonus.sql.
BEGIN;
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
          concat_ws(' — ', 'Recarga Pix R$ ' || translate(to_char(p_valor_pago, 'FM999,999,990.00'), ',.', '.,'), v_obs),
          v_hoje, 'recarga', left(p_usuario, 120), now(), now());
  IF v_bonus > 0 THEN
    INSERT INTO public.creditos_lojas (loja_id, tipo, valor, observacoes, data, origem, criado_por, created_at, updated_at)
    VALUES (p_loja_id, 'bonus', v_bonus,
            format('Bônus do pacote R$ %s (janela até %s)', translate(to_char(p_valor_pago, 'FM999,999,990.00'), ',.', '.,'), to_char((v_janela->>'fim')::date, 'DD/MM')),
            v_hoje, 'recarga', left(p_usuario, 120), now(), now());
  END IF;
  PERFORM set_config('app.credito_recarga', '', true);

  RETURN jsonb_build_object('primeira_recarga', v_primeira, 'valor_pago', p_valor_pago, 'bonus', v_bonus,
                            'credito_total', p_valor_pago + v_bonus, 'janela', v_janela);
END $$;
COMMIT;
