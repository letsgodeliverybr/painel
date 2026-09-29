-- "Vaga Garantida" — admin oferece um ganho mínimo garantido a um
-- entregador específico num período. No fim, confere quanto ele ganhou de
-- verdade em taxas de entrega e credita manualmente a diferença (se
-- houver) — sem crédito automático, decisão do admin em cada fechamento.
--
-- Timestamps NAIVE (sem timezone), populados pelo app já em hora local de
-- Brasília (_agoraBrasilia()) — mesmo padrão de todo o resto do banco
-- (pedidos.created_at, etc.). De propósito SEM DEFAULT now()/DEFAULT
-- CURRENT_TIMESTAMP nas colunas de timestamp — já achamos nesta mesma
-- sessão um bug real (auto_pronto_pedidos) causado exatamente por uma
-- function do banco usando NOW() sem converter fuso; não repete aqui.
CREATE TABLE IF NOT EXISTS public.vagas_garantidas (
  id uuid primary key default gen_random_uuid(),
  entregador_id uuid not null references public.entregadores(id),
  valor_garantido numeric(10,2) not null,
  data_inicio timestamp not null,
  data_fim timestamp not null,
  status text not null default 'ativa' check (status in ('ativa','fechada','cancelada')),
  -- Preenchidos só no fechamento:
  ganho_calculado numeric(10,2),
  valor_complementado numeric(10,2),
  fechado_por uuid references public.usuarios_painel(id),
  fechado_em timestamp,
  -- Preenchidos na criação:
  criado_por uuid references public.usuarios_painel(id),
  criado_em timestamp not null
);

CREATE INDEX IF NOT EXISTS idx_vagas_garantidas_entregador ON public.vagas_garantidas(entregador_id);
CREATE INDEX IF NOT EXISTS idx_vagas_garantidas_status ON public.vagas_garantidas(status);

-- Mesmo padrão de allow-all das outras tabelas deste projeto (RLS real
-- ainda pendente — Fase 1, ver memória/histórico desta conversa).
ALTER TABLE public.vagas_garantidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vagas_garantidas_all ON public.vagas_garantidas;
CREATE POLICY vagas_garantidas_all ON public.vagas_garantidas FOR ALL USING (true) WITH CHECK (true);
