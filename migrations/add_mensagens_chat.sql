-- Chat interno Loja <-> Admin/Suporte, direto no painel.
--
-- Uma conversa única e contínua por loja (não múltiplas threads) — a
-- "conversa" é só o filtro loja_id=eq.X sobre esta tabela, sem precisar de
-- uma tabela de conversas separada.
--
-- remetente_nome é denormalizado de propósito (não só remetente_usuario_id
-- com join) — pedido explícito do usuário pra loja ver o nome de quem
-- escreveu (ex: "Ana - Suporte"), capturado no momento do envio
-- (currentUser.nome), estável mesmo que o usuário mude de nome ou seja
-- removido depois.
--
-- Sem RLS de propósito — mesma realidade do resto do schema hoje (ver
-- security_review_pending): nenhuma tabela usada pelo painel tem RLS
-- habilitada, um INSERT/SELECT direto com a chave anon já funciona em
-- todo o resto do app, então não introduzimos uma exceção isolada aqui.
CREATE TABLE IF NOT EXISTS public.mensagens_chat (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id),
  remetente_perfil text not null, -- 'loja' | 'adm' | 'suporte'
  remetente_usuario_id uuid,
  remetente_nome text,
  texto text not null,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

-- Índice pra buscar/ordenar a conversa de uma loja rapidamente (tela da
-- loja) e pra agregação client-side da lista de conversas (tela do admin).
CREATE INDEX IF NOT EXISTS idx_mensagens_chat_loja_id ON public.mensagens_chat(loja_id, created_at);
