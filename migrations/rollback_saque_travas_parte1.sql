-- Rollback de saque_travas_parte1.sql. Volta solicitar_saque à versão de
-- 2026-09-29 (a que estava no banco) e remove o que a parte 1 criou.
-- ATENÇÃO: apaga alertas_financeiros e as colunas novas de saques
-- (origem/chave_idempotencia/requer_revisao/motivo_revisao) e de
-- entregadores (chave_pix_alterada_em).
BEGIN;

DROP TRIGGER IF EXISTS tg_saque_imutavel ON public.saques;
DROP TRIGGER IF EXISTS tg_carimbar_troca_chave_pix ON public.entregadores;
DROP FUNCTION IF EXISTS public.fn_saque_imutavel();
DROP FUNCTION IF EXISTS public.fn_carimbar_troca_chave_pix();
DROP FUNCTION IF EXISTS public.painel_aprovar_saques(uuid[], text);
DROP FUNCTION IF EXISTS public.painel_recusar_saque(uuid, text, text);
DROP FUNCTION IF EXISTS public.painel_gerar_repasse(jsonb, date, date, text);
DROP FUNCTION IF EXISTS public.painel_listar_alertas_financeiros(boolean);
DROP FUNCTION IF EXISTS public.painel_marcar_alerta_visto(uuid, text);
DROP FUNCTION IF EXISTS public.solicitar_saque(uuid, numeric, text, text, text, text);

CREATE FUNCTION public.solicitar_saque(p_entregador_id uuid, p_valor_bruto numeric, p_chave_pix text, p_tipo_chave_pix text, p_banco text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_total_ganho numeric; v_total_sacado numeric; v_total_creditos numeric; v_saldo numeric;
  v_taxa numeric; v_valor_liquido numeric; v_data_inicio date; v_data_fim date;
  v_ts_inicio timestamptz; v_ts_fim timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_entregador_id::text));
  v_data_inicio := date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_data_fim    := v_data_inicio + 6;
  v_ts_inicio := v_data_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_ts_fim    := (v_data_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';
  SELECT COALESCE(SUM(COALESCE(taxa_motoboy, 0) + COALESCE(gorjeta, 0)), 0) INTO v_total_ganho
  FROM pedidos WHERE motoboy_id = p_entregador_id AND status = 'finalizado'
    AND finalizado_em >= v_ts_inicio AND finalizado_em < v_ts_fim;
  SELECT COALESCE(SUM(valor_bruto), 0) INTO v_total_sacado
  FROM saques WHERE entregador_id = p_entregador_id AND status != 'cancelado'
    AND data_inicio <= v_data_fim AND data_fim > v_data_inicio;
  SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor WHEN tipo = 'debito' THEN -valor ELSE 0 END), 0)
  INTO v_total_creditos FROM creditos_entregadores
  WHERE entregador_id = p_entregador_id AND data >= v_data_inicio AND data <= v_data_fim;
  v_saldo := v_total_ganho - v_total_sacado + v_total_creditos;
  IF p_valor_bruto <= 0 THEN RAISE EXCEPTION 'valor_invalido'; END IF;
  IF p_valor_bruto > v_saldo THEN
    RAISE EXCEPTION 'saldo_insuficiente: disponível R$ %, solicitado R$ %', ROUND(v_saldo, 2), ROUND(p_valor_bruto, 2);
  END IF;
  IF p_valor_bruto < 100 THEN v_taxa := 5.0; ELSE v_taxa := ROUND(p_valor_bruto * 0.05, 2); END IF;
  v_valor_liquido := p_valor_bruto - v_taxa;
  INSERT INTO saques (entregador_id, valor_bruto, taxa, valor_liquido, valor, chave_pix, tipo_chave_pix, banco, status,
    data_inicio, data_fim, created_at, updated_at)
  VALUES (p_entregador_id, p_valor_bruto, v_taxa, v_valor_liquido, p_valor_bruto, p_chave_pix, p_tipo_chave_pix, p_banco, 'pendente',
    v_data_inicio, v_data_fim, now(), now());
  RETURN json_build_object('sucesso', true, 'valor_liquido', v_valor_liquido, 'taxa', v_taxa);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.solicitar_saque(uuid, numeric, text, text, text) TO PUBLIC, anon, authenticated;

ALTER TABLE public.saques DROP CONSTRAINT IF EXISTS saques_entregador_id_fkey;
ALTER TABLE public.saques ADD CONSTRAINT saques_entregador_id_fkey
  FOREIGN KEY (entregador_id) REFERENCES public.entregadores(id);

DROP TABLE IF EXISTS public.alertas_financeiros;
DROP INDEX IF EXISTS public.uq_saques_idempotencia;
DROP INDEX IF EXISTS public.idx_saques_origem_created;
ALTER TABLE public.saques DROP COLUMN IF EXISTS origem, DROP COLUMN IF EXISTS chave_idempotencia,
  DROP COLUMN IF EXISTS requer_revisao, DROP COLUMN IF EXISTS motivo_revisao;
ALTER TABLE public.entregadores DROP COLUMN IF EXISTS chave_pix_alterada_em;
DROP FUNCTION IF EXISTS public._cfg_num(text);
DROP FUNCTION IF EXISTS public._cfg_txt(text);
DELETE FROM public.configuracoes WHERE chave IN ('pix_saida_ativo','saque_valor_minimo','saque_revisao_valor_acima',
  'saque_carencia_troca_chave_horas','saque_teto_diario_plataforma');

COMMIT;
