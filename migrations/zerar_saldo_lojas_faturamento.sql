-- Zera o saldo de crédito residual de lojas de FATURAMENTO (2026-09-30).
-- APLICADA em produção em 2026-09-30 (lista de 16 lojas aprovada).
-- Rollback: rollback_zerar_saldo_lojas_faturamento.sql
--
-- Por quê: lojas de faturamento pagam pela fatura semanal, mas o navegador
-- grava um débito "Entrega #N" em creditos_lojas sempre que a própria loja
-- cria o pedido — o "saldo" negativo delas é resíduo desse bug (e de débitos
-- repetidos), não dívida real. Hoje a loja de faturamento vê esse saldo no
-- botão do topo.
--
-- Como: UM lançamento de ajuste por loja (tipo 'credito', origem
-- 'ajuste_zerar_faturamento'), no valor que leva o saldo a zero. NENHUMA
-- linha existente é apagada ou alterada.
--
-- Lista: as 16 lojas de faturamento com saldo negativo que só têm
-- débitos (nenhuma recarga, crédito manual ou bônus). FICAM DE FORA, aguardando
-- decisão: A PHARMACÊUTICA - RP (+R$ 1.050,00: 2 recargas de R$ 550 no mesmo
-- dia + débito manual de R$ 50) e ACAI ATACADO - RP (+R$ 561,58: recargas de
-- R$ 500 e R$ 92).
--
-- Travas: o valor é recalculado NA HORA de aplicar (novos débitos desde a
-- auditoria entram no ajuste); a loja só é ajustada se continuar de
-- faturamento e sem nenhum crédito/bônus; a coluna "saldo_auditado" mostra o
-- valor visto em 30/09 e o RESULTADO lista auditado × aplicado.
BEGIN;
CREATE TEMP TABLE _zerar(loja_id uuid PRIMARY KEY, saldo_auditado numeric) ON COMMIT DROP;
INSERT INTO _zerar VALUES
  ('619f41be-29a9-4457-a10a-4fbabc0d2e66', -4593.99),  -- NOVIGO CARNES - RP
  ('b9400b5f-0144-4c75-b08c-8e414475a5af', -4156.10),  -- COMAMOR VEGETAL - RP
  ('9ab93086-bd85-4b14-8c51-b982f972476e', -3907.30),  -- UNIÃO SUPLEMENTOS - RP
  ('dd253a0e-9ec8-4d13-be2a-4f84e694d33f', -2552.14),  -- SENSUS BISTRÔ - RP
  ('eacc1a5e-3971-4eb7-9bbd-da0e16246411', -1748.29),  -- DESEJO & SABOR DIEDERICHSEN - RP
  ('d005a9a9-33f6-4955-a892-9aa63b974466', -1747.69),  -- SALGFESTA PLÍNIO - RP
  ('39eeef8f-e6f3-4f87-89ea-8d3003957606', -425.71),  -- SAL & LUZ - RP
  ('8e26b099-86de-4aa1-883d-87939a08447a', -302.81),  -- WALTDOG - RP
  ('df223634-ce79-4cbe-8fc7-3898e551f490', -296.68),  -- ACAI DA FABRICA - RP
  ('c0ccea6d-b946-4a80-88b0-8b3e14f7c402', -276.14),  -- KADU VALLE SALGADINHOS - RP
  ('297c1289-22c1-49ae-9f58-82e06f5e4238', -114.55),  -- GARAPEIRA MARQUES - RP
  ('7c8f567d-82f4-4c24-9095-41e2a15edda8', -95.04),  -- SOLER'S PIZZA - SOR
  ('7ae5b151-9a9c-4b59-8b2a-58cf39e5144a', -59.82),  -- DESEJO & SABOR BOTÂNICO - RP
  ('6b154a83-d3fd-4b9d-a06e-d91271752094', -21.00),  -- @PEDELETSGO
  ('71e96e10-56b4-4552-9a16-246dc5760d2a', -20.48),  -- SLOUNGE - RP
  ('311d7f19-e42a-4a57-9005-e969b0f20151', -12.10);  -- MEU VÉI - RECIFE PE

CREATE TEMP TABLE _aplicado ON COMMIT DROP AS
SELECT z.loja_id, l.nome, z.saldo_auditado,
       round(sum(CASE WHEN c.tipo = 'debito' THEN -c.valor ELSE c.valor END), 2) AS saldo_agora
  FROM _zerar z
  JOIN public.lojas l ON l.id = z.loja_id AND l.tipo_cobranca = 'faturamento'
  JOIN public.creditos_lojas c ON c.loja_id = z.loja_id
 GROUP BY z.loja_id, l.nome, z.saldo_auditado
HAVING count(*) FILTER (WHERE c.tipo IN ('credito', 'bonus')) = 0
   AND round(sum(CASE WHEN c.tipo = 'debito' THEN -c.valor ELSE c.valor END), 2) < 0;

INSERT INTO public.creditos_lojas (loja_id, tipo, valor, observacoes, data, origem, criado_por, created_at, updated_at)
SELECT loja_id, 'credito', -saldo_agora,
       'Ajuste: zera saldo residual de loja de faturamento (débitos de entrega gravados indevidamente; a loja paga pela fatura). Não é crédito real.',
       (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'ajuste_zerar_faturamento', 'zerar_faturamento_2026-09-30', now(), now()
  FROM _aplicado;

-- resultado (auditado × aplicado)
SELECT nome, saldo_auditado, saldo_agora, -saldo_agora AS ajuste_lancado FROM _aplicado ORDER BY saldo_agora;
COMMIT;
