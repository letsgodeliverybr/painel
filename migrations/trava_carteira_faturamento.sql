-- Trava no BANCO: loja que não é de CRÉDITO nunca recebe débito/estorno
-- automático de entrega na carteira (creditos_lojas). PROPOSTA 2026-10-03,
-- NÃO APLICADA. Rollback: rollback_trava_carteira_faturamento.sql
--
-- Por quê no banco: a trava do navegador (_deveDebitarSaldo, 30/09) não
-- segurou os 4 débitos da NOVIGO de 02-03/10 (todos via "Pagamento Recebido"
-- do suporte). Aqui vale pra qualquer navegador, versão antiga ou caminho.
--
-- Regra: origem 'entrega' (débito "Entrega #N") ou 'estorno' ("Estorno #N")
-- só grava se lojas.tipo_cobranca = 'credito'. Faturamento, tipo vazio ou
-- loja não encontrada → a linha é IGNORADA em silêncio (RETURN NULL; o
-- navegador recebe 201 sem linha, sem erro na tela). Na dúvida, não debita.
-- Recarga, bônus e ajuste manual do admin continuam como hoje.
-- A fatura (cobrancas_lojas) não é tocada: ela soma pedidos finalizados.
--
-- Atenção: migrations/troca_cobranca_carimbo_e_debito.sql (proposta) também
-- redefine esta função — se ela for aplicada depois, juntar este bloco nela.
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
  -- Trava 2026-10-03: carteira é só de loja de crédito.
  IF NEW.origem IN ('entrega', 'estorno')
     AND coalesce((SELECT tipo_cobranca FROM public.lojas WHERE id = NEW.loja_id), '') <> 'credito' THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END $$;
COMMIT;
