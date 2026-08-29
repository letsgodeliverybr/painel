-- ROLLBACK EMERGENCIAL da Fase 1 (2026-07-21) — a página de produção
-- sistema.letsgodelivery.com.br tem um override de login que nunca obtém
-- um JWT real do Supabase Auth (nem no login, nem em nenhuma chamada
-- depois) — toda chamada dessa página sempre usa a chave anon, então
-- current_perfil()/auth.uid() nunca resolvem, mesmo pro admin "logado".
-- Painel ficou 100% inutilizável (dados vazios em todo lugar). Restaura
-- o estado allow-all anterior até o override ser corrigido com Auth real.

-- ── 1. Remove a mitigação pontual + todas as policies novas da Fase 1 ──
drop policy if exists "anon_select_temp_mitigacao_login" on public.usuarios_painel;
drop policy if exists "self_or_admin" on public.usuarios_painel;

drop policy if exists "admin_full_access" on public.lojas;
drop policy if exists "loja_own_row" on public.lojas;
drop policy if exists "suporte_select" on public.lojas;

drop policy if exists "admin_full_access" on public.pedidos;
drop policy if exists "loja_own_pedidos" on public.pedidos;
drop policy if exists "suporte_select" on public.pedidos;

drop policy if exists "admin_full_access" on public.entregadores;
drop policy if exists "loja_select" on public.entregadores;
drop policy if exists "suporte_select" on public.entregadores;

drop policy if exists "admin_full_access" on public.creditos_lojas;
drop policy if exists "loja_own" on public.creditos_lojas;

drop policy if exists "admin_full_access" on public.cobrancas_lojas;
drop policy if exists "loja_own" on public.cobrancas_lojas;

drop policy if exists "admin_full_access" on public.creditos_entregadores;
drop policy if exists "admin_full_access" on public.saques;
drop policy if exists "admin_full_access" on public.contas_pagar;

drop policy if exists "admin_full_access" on public.configuracoes;
drop policy if exists "authenticated_select" on public.configuracoes;
drop policy if exists "suporte_update_preco_dinamico" on public.configuracoes;

drop policy if exists "admin_full_access" on public.vagas_motoboy_fixo;
drop policy if exists "suporte_full_access" on public.vagas_motoboy_fixo;

-- ── 2. Recria as policies antigas (allow-all), exatamente como estavam ──
create policy "auth_only" on public.usuarios_painel for all to public using (auth.role() = 'authenticated');
create policy "permitir tudo" on public.usuarios_painel for all to public using (true) with check (true);

create policy "auth_only" on public.lojas for all to public using (auth.role() = 'authenticated');
create policy "permitir tudo" on public.lojas for all to public using (true) with check (true);

create policy "acesso total pedidos" on public.pedidos for all to public using (true);
create policy "admin acessa tudo pedidos" on public.pedidos for all to public
  using (((auth.jwt() ->> 'role') = 'admin') OR ((auth.jwt() ->> 'email') = 'adm@letsgodelivery.com.br'));
create policy "allow_all_pedidos" on public.pedidos for all to anon, authenticated using (true) with check (true);
create policy "permitir tudo por enquanto" on public.pedidos for all to public using (true) with check (true);

create policy "acesso total entregadores" on public.entregadores for all to public using (true);
create policy "acesso_total_entregadores" on public.entregadores for all to public using (true);
create policy "admin acessa tudo entregadores" on public.entregadores for all to public
  using (((auth.jwt() ->> 'role') = 'admin') OR ((auth.jwt() ->> 'email') = 'adm@letsgodelivery.com.br'));
create policy "allow_read_entregadores" on public.entregadores for select to anon using (true);
create policy "permitir tudo" on public.entregadores for all to public using (true) with check (true);

create policy "permitir tudo" on public.creditos_lojas for all to public using (true) with check (true);
create policy "permitir tudo creditos_lojas" on public.creditos_lojas for all to anon, authenticated using (true) with check (true);

create policy "service_role_full_access" on public.cobrancas_lojas for all to public using (true);

create policy "permitir tudo creditos_entregadores" on public.creditos_entregadores for all to public using (true);

create policy "admin acessa tudo saques" on public.saques for all to public
  using (((auth.jwt() ->> 'role') = 'admin') OR ((auth.jwt() ->> 'email') = 'adm@letsgodelivery.com.br'));
create policy "admin_only_saques" on public.saques for all to public using (auth.role() = 'authenticated');
create policy "anon_pode_atualizar_saques" on public.saques for update to anon using (true);
create policy "anon_pode_ler_saques" on public.saques for select to anon using (true);
create policy "anon_pode_tudo_saques" on public.saques for all to anon using (true) with check (true);

create policy "Permitir tudo configuracoes" on public.configuracoes for all to public using (true) with check (true);

-- ── 3. Desliga RLS onde estava desligada originalmente ──────────────────
alter table public.contas_pagar disable row level security;
alter table public.vagas_motoboy_fixo disable row level security;

-- ── 4. Remove os helpers (não usados por nenhuma policy agora) ──────────
drop function if exists public.current_perfil();
drop function if exists public.current_loja_id();
