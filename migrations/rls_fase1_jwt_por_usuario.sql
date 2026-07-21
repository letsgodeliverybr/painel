-- Fase 1 do RLS real (painel): fecha a brecha confirmada em 2026-07-21 —
-- qualquer request com a chave anon estática (pública, embutida no app.js)
-- lia lojas/creditos_lojas/etc. de qualquer loja, sem autenticação real.
--
-- Pré-requisito: app.js já foi atualizado (commit "fix: db()/dbPatch() usam
-- o JWT do usuário logado, não mais a chave anon estática") e confirmado
-- funcionando em produção ANTES de rodar esta migration — as policies de
-- allow-all ainda ativas hoje tornam esse deploy seguro isoladamente; só
-- depois de confirmado é seguro remover essas policies.

-- ── 1. Helpers de identidade ────────────────────────────────────────────
create or replace function public.current_perfil() returns text
language sql stable security definer set search_path = public as $$
  select perfil from usuarios_painel where id = auth.uid() and ativo = true
$$;

create or replace function public.current_loja_id() returns uuid
language sql stable security definer set search_path = public as $$
  select loja_id from usuarios_painel where id = auth.uid() and ativo = true
$$;

-- ── 2. Dropar todas as policies de allow-all (achadas via pg_policies) ──
drop policy if exists "auth_only" on public.usuarios_painel;
drop policy if exists "permitir tudo" on public.usuarios_painel;

drop policy if exists "auth_only" on public.lojas;
drop policy if exists "permitir tudo" on public.lojas;

drop policy if exists "acesso total pedidos" on public.pedidos;
drop policy if exists "admin acessa tudo pedidos" on public.pedidos;
drop policy if exists "allow_all_pedidos" on public.pedidos;
drop policy if exists "permitir tudo por enquanto" on public.pedidos;
-- mantém: "entregador ve apenas seus pedidos" (já usa auth.uid(), já correta)

drop policy if exists "acesso total entregadores" on public.entregadores;
drop policy if exists "acesso_total_entregadores" on public.entregadores;
drop policy if exists "admin acessa tudo entregadores" on public.entregadores;
drop policy if exists "allow_read_entregadores" on public.entregadores;
drop policy if exists "permitir tudo" on public.entregadores;
-- mantém: "entregador ve apenas seu perfil" (já usa auth.uid(), já correta)

drop policy if exists "permitir tudo" on public.creditos_lojas;
drop policy if exists "permitir tudo creditos_lojas" on public.creditos_lojas;

drop policy if exists "service_role_full_access" on public.cobrancas_lojas;

drop policy if exists "permitir tudo creditos_entregadores" on public.creditos_entregadores;

drop policy if exists "admin acessa tudo saques" on public.saques;
drop policy if exists "admin_only_saques" on public.saques;
drop policy if exists "anon_pode_atualizar_saques" on public.saques;
drop policy if exists "anon_pode_ler_saques" on public.saques;
drop policy if exists "anon_pode_tudo_saques" on public.saques;
-- mantém: "entregador ve apenas seus saques", "entregador_insert_proprio_saque",
-- "entregador_select_proprios_saques" (já usam auth.uid(), já corretas)

drop policy if exists "Permitir tudo configuracoes" on public.configuracoes;

-- contas_pagar e vagas_motoboy_fixo: RLS estava totalmente desligada, sem
-- nenhuma policy (não há o que dropar) — só habilitar RLS abaixo.

-- ── 3. Habilitar RLS onde estava desligada ──────────────────────────────
alter table public.contas_pagar enable row level security;
alter table public.vagas_motoboy_fixo enable row level security;

-- ── 4. Policies novas ────────────────────────────────────────────────────

-- usuarios_painel: cada um vê/edita só a própria linha; admin vê todas.
create policy "self_or_admin" on public.usuarios_painel
  for all to authenticated
  using (id = auth.uid() or public.current_perfil() = 'adm');

-- lojas: loja vê/edita só a própria linha (id = loja_id); admin tudo;
-- suporte só leitura (Mapa ao Vivo/Relatório podem precisar do nome da loja).
create policy "admin_full_access" on public.lojas
  for all to authenticated
  using (public.current_perfil() = 'adm');
create policy "loja_own_row" on public.lojas
  for all to authenticated
  using (id = public.current_loja_id());
create policy "suporte_select" on public.lojas
  for select to authenticated
  using (public.current_perfil() = 'suporte');

-- pedidos: loja vê/edita só os próprios; admin tudo; suporte só leitura
-- (Relatório de Entregas, inclusive finalizados).
create policy "admin_full_access" on public.pedidos
  for all to authenticated
  using (public.current_perfil() = 'adm');
create policy "loja_own_pedidos" on public.pedidos
  for all to authenticated
  using (loja_id = public.current_loja_id());
create policy "suporte_select" on public.pedidos
  for select to authenticated
  using (public.current_perfil() = 'suporte');

-- entregadores: mantém "entregador ve apenas seu perfil"; admin tudo;
-- loja e suporte só leitura (loja: popup do mapa, decisão já confirmada
-- antes de manter telefone/CPF visíveis; suporte: Mapa ao Vivo — também
-- expõe pontos_total/pontos_semana do Ranking por ser RLS de linha inteira,
-- não de coluna; tratado como trade-off consciente, não gap, ver plano).
create policy "admin_full_access" on public.entregadores
  for all to authenticated
  using (public.current_perfil() = 'adm');
create policy "loja_select" on public.entregadores
  for select to authenticated
  using (public.current_perfil() = 'loja');
create policy "suporte_select" on public.entregadores
  for select to authenticated
  using (public.current_perfil() = 'suporte');

-- creditos_lojas, cobrancas_lojas: só a própria loja + admin. Suporte SEM
-- policy nenhuma aqui (Financeiro/Créditos/Cobrança fora do escopo dele).
create policy "admin_full_access" on public.creditos_lojas
  for all to authenticated
  using (public.current_perfil() = 'adm');
create policy "loja_own" on public.creditos_lojas
  for all to authenticated
  using (loja_id = public.current_loja_id());

create policy "admin_full_access" on public.cobrancas_lojas
  for all to authenticated
  using (public.current_perfil() = 'adm');
create policy "loja_own" on public.cobrancas_lojas
  for all to authenticated
  using (loja_id = public.current_loja_id());

-- creditos_entregadores, saques, contas_pagar: só admin (+ policies de
-- entregador já existentes em saques). Loja e suporte sem acesso nenhum
-- (Créditos/Saque Rápido fora do escopo de ambos).
create policy "admin_full_access" on public.creditos_entregadores
  for all to authenticated
  using (public.current_perfil() = 'adm');

create policy "admin_full_access" on public.saques
  for all to authenticated
  using (public.current_perfil() = 'adm');

create policy "admin_full_access" on public.contas_pagar
  for all to authenticated
  using (public.current_perfil() = 'adm');

-- configuracoes: admin tudo; suporte só pode EDITAR as chaves de preço
-- dinâmico (Preço Dinâmico é a única exceção no escopo dele); leitura geral
-- liberada pra qualquer perfil autenticado (nenhuma chave hoje é sensível
-- o bastante pra justificar bloquear leitura — revisar se isso mudar).
create policy "admin_full_access" on public.configuracoes
  for all to authenticated
  using (public.current_perfil() = 'adm');
create policy "authenticated_select" on public.configuracoes
  for select to authenticated
  using (true);
create policy "suporte_update_preco_dinamico" on public.configuracoes
  for update to authenticated
  using (public.current_perfil() = 'suporte' and chave like 'preco_dinamico%')
  with check (public.current_perfil() = 'suporte' and chave like 'preco_dinamico%');

-- vagas_motoboy_fixo: admin e suporte têm CRUD completo (Vagas Disponíveis
-- está no escopo do suporte); loja não tem acesso.
create policy "admin_full_access" on public.vagas_motoboy_fixo
  for all to authenticated
  using (public.current_perfil() = 'adm');
create policy "suporte_full_access" on public.vagas_motoboy_fixo
  for all to authenticated
  using (public.current_perfil() = 'suporte');
