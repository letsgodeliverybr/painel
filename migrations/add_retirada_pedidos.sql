-- Pedido de retirada na loja (sem entregador envolvido) — pedido do
-- usuário 2026-09-05: dinheiro só pode ser oferecido nesse caso, nunca em
-- pedido com entrega. Precisa de um jeito de diferenciar as duas
-- modalidades, que não existia em lugar nenhum até aqui (nem no app do
-- cliente, nem no schema). Default false preserva o comportamento atual
-- pra toda linha existente (todo pedido até hoje foi entrega).
alter table public.pedidos
  add column if not exists retirada boolean not null default false;
