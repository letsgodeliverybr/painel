-- C.A.C. (Custo de Aquisição de Cliente) — rastreia qual vendedor/expansão
-- trouxe cada loja nova e calcula o bônus por pedido dela.
--
-- Regra de negócio (2026-09-27):
--   Vendedor  — fixo R$2.200/mês, 2 vagas, meta mínima 880 entregas/mês
--               (pedidos finalizados de TODAS as lojas que ele trouxe,
--               mesmo depois dos 90 dias), bônus R$0,50 por pedido
--               finalizado de loja nova nos primeiros 90 dias.
--   Expansão  — fixo R$6.000/mês, sem meta, mesmo bônus R$0,50/pedido
--               nos primeiros 90 dias.
-- A janela de 90 dias conta a partir de lojas.vendedor_atribuido_em (data
-- em que o vendedor foi ligado à loja — decisão do usuário 2026-09-27: loja
-- antiga que ganha vendedor agora começa a contar de hoje, não da data de
-- cadastro original). Trocar o vendedor reinicia a contagem pro novo.
-- O cálculo em si fica no painel (_cacCalcular em app.js).
--
-- vendedores.criado_em e lojas.vendedor_atribuido_em sem DEFAULT now() de
-- propósito — mesmo padrão de
-- vagas_garantidas: o app manda _agoraBrasilia() (hora de parede de
-- Brasília, timestamp sem fuso).

CREATE TABLE IF NOT EXISTS public.cargos_comerciais (
  id text primary key,
  nome text not null,
  salario_fixo numeric(10,2) not null,
  vagas integer,
  meta_entregas_mes integer,
  bonus_por_pedido numeric(10,2) not null,
  janela_bonus_dias integer not null default 90
);

INSERT INTO public.cargos_comerciais (id,nome,salario_fixo,vagas,meta_entregas_mes,bonus_por_pedido,janela_bonus_dias) VALUES
  ('vendedor','Vendedor',2200.00,2,880,0.50,90),
  ('expansao','Expansão',6000.00,null,null,0.50,90)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.vendedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cargo_id text not null references public.cargos_comerciais(id),
  telefone text,
  ativo boolean not null default true,
  criado_em timestamp not null
);

-- Vendedor responsável pela loja. ON DELETE SET NULL: excluir um vendedor
-- não apaga/trava a loja, só some a atribuição.
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS vendedor_id uuid references public.vendedores(id) on delete set null,
  ADD COLUMN IF NOT EXISTS vendedor_atribuido_em timestamp;
CREATE INDEX IF NOT EXISTS idx_lojas_vendedor ON public.lojas(vendedor_id);

-- Mesmo padrão allow-all das outras tabelas deste projeto (RLS real ainda
-- pendente — Fase 1).
ALTER TABLE public.cargos_comerciais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cargos_comerciais_all ON public.cargos_comerciais;
CREATE POLICY cargos_comerciais_all ON public.cargos_comerciais FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendedores_all ON public.vendedores;
CREATE POLICY vendedores_all ON public.vendedores FOR ALL USING (true) WITH CHECK (true);
