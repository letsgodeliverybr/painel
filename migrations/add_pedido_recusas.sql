-- Rastreio de recusas de pedido pelo entregador (2026-09-10) — alimenta o
-- card "Meu desempenho hoje" (Aceitas/Finalizadas/Recusadas) na tela
-- offline (Home) do app do entregador.
--
-- Antes disso, recusar um pedido (aceitar_pedido_screen.dart._recusar() e
-- rota_disponivel_screen.dart._rejeitar()) era só navegação local
-- (Navigator.pop/pushReplacement) — nada gravava no banco, não tinha como
-- calcular "quantas recusas hoje" de verdade.
--
-- Tabela de LOG (não de estado): um pedido pode ser recusado por vários
-- entregadores diferentes (a oferta continua disponível pros outros depois
-- de uma recusa) — por isso não é uma coluna em pedidos, é uma linha nova
-- por evento de recusa, sem unique constraint em pedido_id.
CREATE TABLE IF NOT EXISTS public.pedido_recusas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  entregador_id uuid not null references public.entregadores(id) on delete cascade,
  recusado_em timestamptz not null default now()
);

-- Índice composto pra acelerar a query do card ("recusas do entregador X
-- hoje") — filtro por entregador_id + range de recusado_em.
CREATE INDEX IF NOT EXISTS idx_pedido_recusas_entregador_data
  ON public.pedido_recusas(entregador_id, recusado_em);

ALTER TABLE public.pedido_recusas ENABLE ROW LEVEL SECURITY;

-- Entregador só grava/lê a própria recusa — mesmo padrão de auth.uid() =
-- entregadores.id usado no resto do app (ver lib/services/
-- tela_pos_login_service.dart, .eq('id', session.user.id)).
DROP POLICY IF EXISTS "entregador insere própria recusa" ON public.pedido_recusas;
CREATE POLICY "entregador insere própria recusa"
  ON public.pedido_recusas FOR INSERT
  TO authenticated
  WITH CHECK (entregador_id = auth.uid());

DROP POLICY IF EXISTS "entregador lê próprias recusas" ON public.pedido_recusas;
CREATE POLICY "entregador lê próprias recusas"
  ON public.pedido_recusas FOR SELECT
  TO authenticated
  USING (entregador_id = auth.uid());
