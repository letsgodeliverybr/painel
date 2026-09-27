-- C.A.C. — meta mensal vira faixa (mínimo → teto) e Expansão passa a ter
-- meta (2026-09-27). Bate a meta ao atingir o MÍNIMO
-- (meta_entregas_mes); o teto (meta_entregas_mes_teto) é só informativo,
-- não é limite superior pra "bater".
--   Vendedor: 880 a 2.500 pedidos/mês
--   Expansão: 2.500 a 8.000 pedidos/mês
ALTER TABLE public.cargos_comerciais
  ADD COLUMN IF NOT EXISTS meta_entregas_mes_teto integer;

UPDATE public.cargos_comerciais SET meta_entregas_mes=880,  meta_entregas_mes_teto=2500 WHERE id='vendedor';
UPDATE public.cargos_comerciais SET meta_entregas_mes=2500, meta_entregas_mes_teto=8000 WHERE id='expansao';
