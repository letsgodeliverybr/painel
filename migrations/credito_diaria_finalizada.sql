-- Crédito automático da diária finalizada (2026-09-30).
-- Rollback: rollback_credito_diaria_finalizada.sql
--
-- Por quê: finalizar a vaga no painel (_vagasMudarStatus, app.js) só muda
-- vagas_motoboy_fixo.status para 'finalizada' — nenhum valor era lançado
-- pro entregador. A diária de 30/09 (vaga 8c405b4f, R$ 30, Gabriel) ficou
-- fora do saldo, do "valor do dia" e do extrato do app, e do relatório de
-- pagamento do painel. O saldo (app calcularSaldoSemana, banco
-- solicitar_saque, painel Gerar Pagamento) já soma creditos_entregadores;
-- então o crédito entra lá, uma vez, e passa a valer em todos.
--
-- Regras:
--   - vaga passa a 'finalizada' com entregador e valor > 0 → 1 crédito
--     "Diária Finalizada - <loja>" com data = dia da vaga.
--   - vaga sai de 'finalizada' (ex.: cancelada depois) → 1 débito
--     "Estorno De Diária - <loja>" (não apaga o crédito, deixa rastro).
--   - vaga_id + tipo é único: re-finalizar/re-salvar nunca duplica.

ALTER TABLE public.creditos_entregadores
  ADD COLUMN IF NOT EXISTS vaga_id uuid REFERENCES public.vagas_motoboy_fixo(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS creditos_entregadores_vaga_tipo_uniq
  ON public.creditos_entregadores (vaga_id, tipo) WHERE vaga_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_credito_diaria_finalizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loja text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT nome INTO v_loja FROM public.lojas WHERE id = NEW.loja_id;

  IF NEW.status = 'finalizada' AND NEW.entregador_id IS NOT NULL AND coalesce(NEW.valor, 0) > 0 THEN
    INSERT INTO public.creditos_entregadores (entregador_id, tipo, valor, observacoes, data, vaga_id, created_at, updated_at)
    VALUES (NEW.entregador_id, 'credito', NEW.valor, 'Diária Finalizada - ' || coalesce(v_loja, 'Loja'), NEW.data, NEW.id, now(), now())
    ON CONFLICT (vaga_id, tipo) WHERE vaga_id IS NOT NULL DO NOTHING;
  ELSIF OLD.status = 'finalizada' THEN
    -- só estorna se houve crédito dessa vaga
    INSERT INTO public.creditos_entregadores (entregador_id, tipo, valor, observacoes, data, vaga_id, created_at, updated_at)
    SELECT c.entregador_id, 'debito', c.valor, 'Estorno De Diária - ' || coalesce(v_loja, 'Loja'), c.data, c.vaga_id, now(), now()
      FROM public.creditos_entregadores c
     WHERE c.vaga_id = NEW.id AND c.tipo = 'credito'
    ON CONFLICT (vaga_id, tipo) WHERE vaga_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_credito_diaria_finalizada ON public.vagas_motoboy_fixo;
CREATE TRIGGER tg_credito_diaria_finalizada
  AFTER UPDATE OF status ON public.vagas_motoboy_fixo
  FOR EACH ROW EXECUTE FUNCTION public.fn_credito_diaria_finalizada();

-- Diárias já finalizadas antes do gatilho (hoje: só a 8c405b4f, R$ 30).
INSERT INTO public.creditos_entregadores (entregador_id, tipo, valor, observacoes, data, vaga_id, created_at, updated_at)
SELECT v.entregador_id, 'credito', v.valor, 'Diária Finalizada - ' || coalesce(l.nome, 'Loja'), v.data, v.id, now(), now()
  FROM public.vagas_motoboy_fixo v
  LEFT JOIN public.lojas l ON l.id = v.loja_id
 WHERE v.status = 'finalizada' AND v.entregador_id IS NOT NULL AND coalesce(v.valor, 0) > 0
ON CONFLICT (vaga_id, tipo) WHERE vaga_id IS NOT NULL DO NOTHING;

-- Descrição em Title Case (2026-10-01): corrige o lançamento já feito com o
-- texto anterior ("Diária finalizada - …"). Idempotente.
UPDATE public.creditos_entregadores
   SET observacoes = 'Diária Finalizada - ' || substring(observacoes from length('Diária finalizada - ') + 1), updated_at = now()
 WHERE vaga_id IS NOT NULL AND observacoes LIKE 'Diária finalizada - %';
UPDATE public.creditos_entregadores
   SET observacoes = 'Estorno De Diária - ' || substring(observacoes from length('Estorno de diária - ') + 1), updated_at = now()
 WHERE vaga_id IS NOT NULL AND observacoes LIKE 'Estorno de diária - %';
