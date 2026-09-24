-- Limite de pedidos simultâneos por loja, no aceite sozinho do entregador
-- (tela "Disponíveis" do app entregador). Alocação manual pelo admin no
-- painel usa uma trava separada e fixa (LIMITE_PEDIDOS_ALOCACAO_MANUAL=4
-- em app.js), independente dessa configuração por loja.
--
-- Padrão 2 pra lojas novas (a maioria dos estabelecimentos). Algumas
-- categorias (petshop, farmácia — pedidos menores/mais rápidos) tendem a
-- precisar de mais; não é automático por categoria, é ajustado manualmente
-- por loja em Cadastros > Lojas > Editar.
--
-- 2026-09-24
alter table public.lojas
  add column if not exists limite_pedidos_simultaneos integer not null default 2;
