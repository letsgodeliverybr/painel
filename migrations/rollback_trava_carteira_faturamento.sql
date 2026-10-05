-- Desfaz migrations/trava_carteira_faturamento.sql: volta fn_creditos_lojas_origem
-- ao corpo de antes (sem a trava de loja de faturamento).
BEGIN;
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
COMMIT;
