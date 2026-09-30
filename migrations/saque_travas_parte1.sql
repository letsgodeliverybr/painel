-- Travas do Saque Rápido — PARTE 1 (não quebra nada; pode ir antes da Fase 1).
-- Regras consolidadas em 2026-09-29. NÃO APLICADA. Rollback: rollback_saque_travas_parte1.sql
--
-- Regras:
--  • Sem limite por saque nem por dia: só o saldo (e o mínimo de R$ 10 que o
--    app já exigia — abaixo disso a taxa de R$ 5 comeria o saque).
--  • Acima de R$ 800 → saque criado com requer_revisao + alerta pro admin.
--  • Carência de 24 h após trocar a chave Pix: saque RECUSADO com erro claro,
--    nenhum saque criado, saldo intacto. Usa entregadores.chave_pix_alterada_em,
--    carimbada NO SERVIDOR (gatilho) a cada troca — trocar de novo reinicia.
--  • Chave de qualquer tipo, desde que o titular seja o CPF do entregador.
--    Sem a consulta do titular (DICT, provedor), chave que não seja o próprio
--    CPF do entregador → revisão do admin (não bloqueia).
--  • Interruptor pix_saida_ativo ('true' = pedidos de saque liberados).
--  • Teto diário da plataforma: mecanismo pronto, DESLIGADO (valor a definir).
--  • Entregador = usuário logado (auth.uid()); chave lida do CADASTRO; anon
--    perde EXECUTE; recusado não prende saldo; idempotência opcional; saque
--    imutável depois de criado (valor/chave/entregador) e depois de finalizado.
--  • Funções do painel (aprovar/recusar/gerar repasse/alertas) — preparam a PARTE 2.
--  • Continua existindo o gatilho de antes: no máximo 3 saques PENDENTES ao
--    mesmo tempo por entregador (não é limite por dia).
-- Gorjeta: a conta do saldo continua taxa_motoboy + gorjeta (decisão pendente).

BEGIN;

-- ── Configurações (só cria se não existir) ──────────────────────────────────
INSERT INTO public.configuracoes (chave, valor)
SELECT k, v FROM (VALUES
  ('pix_saida_ativo',                   'true'),
  ('saque_valor_minimo',                '10'),
  ('saque_revisao_valor_acima',         '800'),
  ('saque_carencia_troca_chave_horas',  '24'),
  ('saque_teto_diario_plataforma',      '')
) AS x(k, v)
WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes c WHERE c.chave = x.k);

CREATE OR REPLACE FUNCTION public._cfg_txt(p_chave text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT nullif(trim(valor), '') FROM public.configuracoes WHERE chave = p_chave;
$$;
CREATE OR REPLACE FUNCTION public._cfg_num(p_chave text) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public._cfg_txt(p_chave) ~ '^[0-9]+([.,][0-9]+)?$'
              THEN replace(public._cfg_txt(p_chave), ',', '.')::numeric END;
$$;
REVOKE EXECUTE ON FUNCTION public._cfg_txt(text), public._cfg_num(text) FROM PUBLIC, anon, authenticated;

-- ── Colunas novas ───────────────────────────────────────────────────────────
ALTER TABLE public.entregadores ADD COLUMN IF NOT EXISTS chave_pix_alterada_em timestamptz;
ALTER TABLE public.saques
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS chave_idempotencia text,
  ADD COLUMN IF NOT EXISTS requer_revisao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_revisao text;
-- origem explícita (antes: "chave_pix preenchida = saque rápido")
UPDATE public.saques SET origem = CASE WHEN chave_pix IS NOT NULL THEN 'rapido' ELSE 'repasse' END WHERE origem IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_saques_idempotencia
  ON public.saques (entregador_id, chave_idempotencia) WHERE chave_idempotencia IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saques_origem_created ON public.saques (origem, created_at);

-- excluir entregador: saques ficam, sem vínculo (substitui o PATCH do painel)
ALTER TABLE public.saques DROP CONSTRAINT IF EXISTS saques_entregador_id_fkey;
ALTER TABLE public.saques ADD CONSTRAINT saques_entregador_id_fkey
  FOREIGN KEY (entregador_id) REFERENCES public.entregadores(id) ON DELETE SET NULL;

-- ── Alertas (item 9) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alertas_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  entregador_id uuid,
  saque_id uuid,
  detalhe jsonb NOT NULL DEFAULT '{}',
  criado_em timestamptz NOT NULL DEFAULT now(),
  visto_em timestamptz,
  visto_por text
);
ALTER TABLE public.alertas_financeiros ENABLE ROW LEVEL SECURITY; -- sem política: só pelas funções

-- ── Carência: carimba a troca de chave (item 5) ────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_carimbar_troca_chave_pix() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.chave_pix IS DISTINCT FROM OLD.chave_pix OR NEW.tipo_chave_pix IS DISTINCT FROM OLD.tipo_chave_pix THEN
    NEW.chave_pix_alterada_em := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_carimbar_troca_chave_pix ON public.entregadores;
CREATE TRIGGER tg_carimbar_troca_chave_pix BEFORE UPDATE OF chave_pix, tipo_chave_pix ON public.entregadores
  FOR EACH ROW EXECUTE FUNCTION public.fn_carimbar_troca_chave_pix();

-- ── Saque imutável (item 3) ─────────────────────────────────────────────────
-- Valor, chave e entregador nunca mudam depois de criado (só entregador_id →
-- NULL, pela exclusão do entregador). Status só sai de 'pendente'. Pago/
-- recusado/cancelado não mudam mais — o 2º clique de "Aprovar" vira erro em
-- vez de pagar/descontar de novo.
CREATE OR REPLACE FUNCTION public.fn_saque_imutavel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.entregador_id IS DISTINCT FROM OLD.entregador_id AND NEW.entregador_id IS NOT NULL)
     OR NEW.valor IS DISTINCT FROM OLD.valor OR NEW.valor_bruto IS DISTINCT FROM OLD.valor_bruto
     OR NEW.taxa IS DISTINCT FROM OLD.taxa OR NEW.valor_liquido IS DISTINCT FROM OLD.valor_liquido
     OR NEW.chave_pix IS DISTINCT FROM OLD.chave_pix OR NEW.tipo_chave_pix IS DISTINCT FROM OLD.tipo_chave_pix
     OR NEW.banco IS DISTINCT FROM OLD.banco OR NEW.chave_idempotencia IS DISTINCT FROM OLD.chave_idempotencia
     OR NEW.data_inicio IS DISTINCT FROM OLD.data_inicio OR NEW.data_fim IS DISTINCT FROM OLD.data_fim THEN
    RAISE EXCEPTION 'saque_imutavel: valor, chave e entregador não podem ser alterados';
  END IF;
  IF OLD.status IS DISTINCT FROM 'pendente'
     AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.aprovado_em IS DISTINCT FROM OLD.aprovado_em) THEN
    RAISE EXCEPTION 'saque_finalizado: saque % já está %', OLD.id, OLD.status;
  END IF;
  IF NEW.status NOT IN ('pendente','pago','recusado','cancelado') THEN
    RAISE EXCEPTION 'saque_status_invalido: %', NEW.status;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_saque_imutavel ON public.saques;
CREATE TRIGGER tg_saque_imutavel BEFORE UPDATE ON public.saques
  FOR EACH ROW EXECUTE FUNCTION public.fn_saque_imutavel();

-- ── solicitar_saque nova (itens 1, 2, 3, 4, 5, 6, 7, 8, 9) ─────────────────
-- Mesmos 5 parâmetros de antes (o app atual continua funcionando) + 1 opcional.
DROP FUNCTION IF EXISTS public.solicitar_saque(uuid, numeric, text, text, text);
CREATE FUNCTION public.solicitar_saque(
  p_entregador_id uuid, p_valor_bruto numeric, p_chave_pix text, p_tipo_chave_pix text, p_banco text,
  p_chave_idempotencia text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  e record; s record;
  v_data_inicio date; v_data_fim date; v_ts_inicio timestamptz; v_ts_fim timestamptz;
  v_hoje_ini timestamptz;
  v_total_ganho numeric; v_total_sacado numeric; v_total_creditos numeric; v_saldo numeric;
  v_taxa numeric; v_valor_liquido numeric;
  v_teto numeric; v_car numeric; v_alerta numeric; v_plat numeric; v_falta_min int;
  v_motivos text[] := '{}'; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'nao_autenticado'; END IF;
  IF p_entregador_id IS NOT NULL AND p_entregador_id <> v_uid THEN RAISE EXCEPTION 'entregador_invalido'; END IF;
  IF coalesce(public._cfg_txt('pix_saida_ativo'), 'true') <> 'true' THEN
    RAISE EXCEPTION USING MESSAGE = 'Os saques estão temporariamente indisponíveis. Tente mais tarde.', HINT = 'saque_desativado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text));

  -- idempotência: mesma chave → devolve o saque já criado, sem criar outro
  IF p_chave_idempotencia IS NOT NULL THEN
    SELECT * INTO s FROM public.saques WHERE entregador_id = v_uid AND chave_idempotencia = p_chave_idempotencia;
    IF FOUND THEN
      RETURN json_build_object('sucesso', true, 'valor_liquido', s.valor_liquido, 'taxa', s.taxa, 'repetido', true);
    END IF;
  END IF;

  SELECT id, cpf, status, aprovado, chave_pix, tipo_chave_pix, banco, chave_pix_alterada_em
    INTO e FROM public.entregadores WHERE id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'entregador_invalido'; END IF;
  IF e.status = 'bloqueado' OR e.aprovado IS NOT TRUE THEN RAISE EXCEPTION 'entregador_bloqueado'; END IF;
  IF coalesce(trim(e.chave_pix), '') = '' THEN RAISE EXCEPTION 'sem_chave_pix'; END IF;

  -- carência: RECUSA (RAISE desfaz tudo — nenhum saque criado, saldo intacto)
  v_car := coalesce(public._cfg_num('saque_carencia_troca_chave_horas'), 0);
  IF v_car > 0 AND e.chave_pix_alterada_em > now() - make_interval(secs => v_car * 3600) THEN
    v_falta_min := ceil(extract(epoch FROM (e.chave_pix_alterada_em + make_interval(secs => v_car * 3600)) - now()) / 60)::int;
    RAISE EXCEPTION USING
      MESSAGE = format('Você alterou sua chave Pix há pouco. Por segurança, o saque libera em %sh %smin.', v_falta_min / 60, v_falta_min % 60),
      HINT = 'chave_pix_em_carencia';
  END IF;

  IF p_valor_bruto IS NULL OR p_valor_bruto <= 0 THEN RAISE EXCEPTION 'valor_invalido'; END IF;
  IF p_valor_bruto < coalesce(public._cfg_num('saque_valor_minimo'), 0) THEN
    RAISE EXCEPTION 'valor_invalido: mínimo R$ %', public._cfg_num('saque_valor_minimo');
  END IF;

  -- saldo da semana (mesma regra de antes, exceto: RECUSADO não prende saldo)
  v_data_inicio := date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_data_fim    := v_data_inicio + 6;
  v_ts_inicio   := v_data_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_ts_fim      := (v_data_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';
  SELECT COALESCE(SUM(COALESCE(taxa_motoboy, 0) + COALESCE(gorjeta, 0)), 0) INTO v_total_ganho
    FROM public.pedidos WHERE motoboy_id = v_uid AND status = 'finalizado'
     AND finalizado_em >= v_ts_inicio AND finalizado_em < v_ts_fim;
  SELECT COALESCE(SUM(valor_bruto), 0) INTO v_total_sacado
    FROM public.saques WHERE entregador_id = v_uid AND status NOT IN ('cancelado', 'recusado')
     AND data_inicio <= v_data_fim AND data_fim > v_data_inicio;
  SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor WHEN tipo = 'debito' THEN -valor ELSE 0 END), 0)
    INTO v_total_creditos FROM public.creditos_entregadores
   WHERE entregador_id = v_uid AND data >= v_data_inicio AND data <= v_data_fim;
  v_saldo := v_total_ganho - v_total_sacado + v_total_creditos;
  IF p_valor_bruto > v_saldo THEN
    RAISE EXCEPTION 'saldo_insuficiente: disponível R$ %, solicitado R$ %', ROUND(v_saldo, 2), ROUND(p_valor_bruto, 2);
  END IF;

  v_hoje_ini := (now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_teto := public._cfg_num('saque_teto_diario_plataforma');
  IF v_teto IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('saque_teto_diario_plataforma'));
    SELECT COALESCE(SUM(valor_bruto), 0) INTO v_plat FROM public.saques
     WHERE origem = 'rapido' AND status NOT IN ('cancelado', 'recusado') AND created_at >= v_hoje_ini;
    IF v_plat + p_valor_bruto > v_teto THEN
      RAISE EXCEPTION USING MESSAGE = 'O limite diário de saques foi atingido. Tente novamente amanhã.', HINT = 'teto_diario_plataforma';
    END IF;
  END IF;

  v_taxa := CASE WHEN p_valor_bruto < 100 THEN 5.0 ELSE ROUND(p_valor_bruto * 0.05, 2) END;
  v_valor_liquido := p_valor_bruto - v_taxa;

  -- revisão do admin (o saque é criado, pendente, marcado + alerta)
  v_alerta := public._cfg_num('saque_revisao_valor_acima');
  IF v_alerta IS NOT NULL AND p_valor_bruto > v_alerta THEN v_motivos := array_append(v_motivos, 'valor_acima_limite'); END IF;
  -- titular: sem a consulta DICT, só a chave CPF = CPF do próprio entregador
  -- é aceita direto; qualquer outra chave vai pra revisão
  IF NOT (lower(coalesce(e.tipo_chave_pix, '')) = 'cpf'
          AND length(regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g')) = 11
          AND regexp_replace(e.chave_pix, '\D', '', 'g') = regexp_replace(e.cpf, '\D', '', 'g')) THEN
    v_motivos := array_append(v_motivos, 'chave_nao_e_cpf_do_entregador');
  END IF;

  INSERT INTO public.saques (
    entregador_id, valor_bruto, taxa, valor_liquido, valor,
    chave_pix, tipo_chave_pix, banco, status, data_inicio, data_fim,
    origem, chave_idempotencia, requer_revisao, motivo_revisao, created_at, updated_at
  ) VALUES (
    v_uid, p_valor_bruto, v_taxa, v_valor_liquido, p_valor_bruto,
    e.chave_pix, e.tipo_chave_pix, e.banco, 'pendente', v_data_inicio, v_data_fim,
    'rapido', p_chave_idempotencia, cardinality(v_motivos) > 0, nullif(array_to_string(v_motivos, ','), ''), now(), now()
  ) RETURNING id INTO v_id;

  IF cardinality(v_motivos) > 0 THEN
    INSERT INTO public.alertas_financeiros (tipo, entregador_id, saque_id, detalhe)
    VALUES ('saque_para_revisao', v_uid, v_id, jsonb_build_object('motivos', v_motivos, 'valor', p_valor_bruto));
  END IF;

  RETURN json_build_object('sucesso', true, 'valor_liquido', v_valor_liquido, 'taxa', v_taxa);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.solicitar_saque(uuid, numeric, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_saque(uuid, numeric, text, text, text, text) TO authenticated;

-- ── Funções do painel (preparam a PARTE 2) ─────────────────────────────────
-- Enquanto não houver Fase 1 elas continuam chamáveis pela chave anon, como
-- as escritas diretas de hoje — mas só fazem a transição permitida (não dá
-- pra trocar chave/valor por aqui). p_usuario = quem clicou (auditoria).
CREATE OR REPLACE FUNCTION public.painel_aprovar_saques(p_ids uuid[], p_usuario text)
RETURNS TABLE(id uuid, entregador_id uuid, valor numeric, valor_liquido numeric, origem text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.saques s SET status = 'pago', aprovado_em = now(), updated_at = now(),
         observacao = concat_ws(' | ', nullif(s.observacao, ''), 'aprovado por ' || left(p_usuario, 120))
   WHERE s.id = ANY (p_ids) AND s.status = 'pendente'
  RETURNING s.id, s.entregador_id, s.valor, s.valor_liquido, s.origem;
$$;
CREATE OR REPLACE FUNCTION public.painel_recusar_saque(p_id uuid, p_usuario text, p_motivo text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.saques SET status = 'recusado', updated_at = now(),
         observacao = concat_ws(' | ', nullif(observacao, ''), 'recusado por ' || left(p_usuario, 120), nullif(p_motivo, ''))
   WHERE id = p_id AND status = 'pendente';
  RETURN FOUND;
END $$;
-- repasse semanal (Gerar Pagamentos): [{entregador_id, valor, qtd_pedidos}]
CREATE OR REPLACE FUNCTION public.painel_gerar_repasse(p_itens jsonb, p_data_inicio date, p_data_fim date, p_usuario text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.saques (entregador_id, valor, qtd_pedidos, data_inicio, data_fim, status, origem, observacao, created_at, updated_at)
  SELECT (i->>'entregador_id')::uuid, round((i->>'valor')::numeric, 2), (i->>'qtd_pedidos')::int,
         p_data_inicio, p_data_fim, 'pendente', 'repasse', 'gerado por ' || left(p_usuario, 120), now(), now()
    FROM jsonb_array_elements(p_itens) i
   WHERE (i->>'valor')::numeric > 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.painel_listar_alertas_financeiros(p_so_novos boolean DEFAULT true)
RETURNS SETOF public.alertas_financeiros LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.alertas_financeiros WHERE NOT p_so_novos OR visto_em IS NULL ORDER BY criado_em DESC LIMIT 200;
$$;
CREATE OR REPLACE FUNCTION public.painel_marcar_alerta_visto(p_id uuid, p_usuario text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.alertas_financeiros SET visto_em = now(), visto_por = left(p_usuario, 120) WHERE id = p_id AND visto_em IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_carimbar_troca_chave_pix(), public.fn_saque_imutavel() FROM PUBLIC, anon, authenticated;

COMMIT;
