-- Estende mensagens_chat (hoje só loja↔admin/suporte) pro chat "Parceiro
-- Let's Go" do app do entregador. 100% aditivo — nenhuma linha existente é
-- tocada, nenhuma query hoje (?loja_id=eq.X) quebra, já que toda linha de
-- loja continua com loja_id preenchido como sempre.
--
-- motivo (texto solto, não enum) guarda o motivo exato escolhido no bot
-- (ex: "Preciso sair do pedido") — separado do texto formatado da
-- mensagem, pra a lista do painel poder destacar visualmente sem parsear
-- string livre. Lista de motivos evolui só no código do app do entregador
-- (nenhum valor fixo aqui no banco), por pedido explícito do usuário.
alter table public.mensagens_chat
  alter column loja_id drop not null,
  add column if not exists entregador_id uuid references entregadores(id),
  add column if not exists pedido_id uuid references pedidos(id),
  add column if not exists motivo text;

alter table public.mensagens_chat
  add constraint mensagens_chat_participante_check
  check (loja_id is not null or entregador_id is not null);

create index if not exists idx_mensagens_chat_entregador_id
  on public.mensagens_chat (entregador_id, created_at);
