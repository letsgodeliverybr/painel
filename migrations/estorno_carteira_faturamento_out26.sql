-- Limpeza: devolve a zero o saldo NEGATIVO de lojas de faturamento, criado por
-- débitos de entrega gravados indevidamente depois do zeramento de 30/09.
-- PROPOSTA 2026-10-03, NÃO APLICADA. Aplicar DEPOIS da trava
-- (trava_carteira_faturamento.sql), senão novos débitos voltam a entrar.
-- Rollback: rollback_estorno_carteira_faturamento_out26.sql
--
-- Mesmo método do zeramento de 30/09: um lançamento de ajuste (crédito) por
-- loja no valor exato do negativo; os débitos originais ficam no histórico.
-- Em 03/10 só a NOVIGO CARNES - RP entra: -65,10 =
--   Entrega #37 22,40 (02/10) + #41 10,50 + #40 15,40 + #42 16,80 (03/10).
-- Saldo POSITIVO (ACAI ATACADO 561,58 e A PHARMACÊUTICA 1.050,00 = recargas
-- pagas de verdade) NÃO entra aqui: precisa de decisão à parte.
-- Não toca cobrancas_lojas nem pedidos: a fatura continua somando os pedidos.
--
-- Conferência antes (somente leitura):
--   SELECT l.nome, sum(CASE WHEN c.tipo='debito' THEN -c.valor ELSE c.valor END) saldo
--     FROM creditos_lojas c JOIN lojas l ON l.id=c.loja_id
--    WHERE coalesce(l.tipo_cobranca,'') <> 'credito' GROUP BY 1 HAVING
--          sum(CASE WHEN c.tipo='debito' THEN -c.valor ELSE c.valor END) < 0;
BEGIN;
INSERT INTO public.creditos_lojas (loja_id, tipo, valor, observacoes, data, origem, created_at, updated_at)
SELECT s.loja_id, 'credito', -s.saldo,
       'Ajuste: zera saldo residual de loja de faturamento (débitos de entrega gravados indevidamente em out/26; a loja paga pela fatura). Não é crédito real.',
       public.hoje_brasilia(), 'ajuste_zerar_faturamento', now(), now()
  FROM (SELECT c.loja_id, sum(CASE WHEN c.tipo = 'debito' THEN -c.valor ELSE c.valor END) saldo
          FROM public.creditos_lojas c JOIN public.lojas l ON l.id = c.loja_id
         WHERE coalesce(l.tipo_cobranca, '') <> 'credito'
         GROUP BY c.loja_id) s
 WHERE s.saldo < 0
   AND s.loja_id = '619f41be-29a9-4457-a10a-4fbabc0d2e66'; -- só NOVIGO CARNES - RP (aprovado 2026-10-05)
COMMIT;
