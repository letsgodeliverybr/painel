-- Melhoria visual/segurança operacional do app do entregador, item 2
-- (tela "Status do cadastro"): hoje só existe aprovação do CADASTRO
-- INTEIRO (entregadores.aprovado/status_cadastro/motivo_reprovacao) — sem
-- rastreio por documento. Adiciona status + motivo individual pros 5
-- documentos hoje cadastrados (foto_perfil, foto_cnh, foto_crlv,
-- foto_comprovante_residencia, foto_placa — não existe campo de RENAVAM
-- separado, é coberto pelo foto_crlv).
--
-- status_cadastro/aprovado CONTINUAM existindo e sendo a fonte pro
-- painel (badges/filtros/listagens, ~15 lugares em app.js) — não são
-- substituídos. Só deixam de ser a fonte de verdade pro GATE do app do
-- entregador, que passa a checar os 5 status abaixo diretamente (ver
-- lib/main.dart AuthGate). Continuam sendo mantidos em sincronia pelo
-- código do painel (aprovar/reprovar documento individual recalcula os
-- dois automaticamente).
alter table public.entregadores
  add column if not exists foto_perfil_status text not null default 'em_analise',
  add column if not exists foto_cnh_status text not null default 'em_analise',
  add column if not exists foto_crlv_status text not null default 'em_analise',
  add column if not exists foto_comprovante_residencia_status text not null default 'em_analise',
  add column if not exists foto_placa_status text not null default 'em_analise',
  add column if not exists foto_perfil_motivo text,
  add column if not exists foto_cnh_motivo text,
  add column if not exists foto_crlv_motivo text,
  add column if not exists foto_comprovante_residencia_motivo text,
  add column if not exists foto_placa_motivo text;

alter table public.entregadores
  add constraint entregadores_foto_perfil_status_check check (foto_perfil_status in ('em_analise','aprovado','reprovado')),
  add constraint entregadores_foto_cnh_status_check check (foto_cnh_status in ('em_analise','aprovado','reprovado')),
  add constraint entregadores_foto_crlv_status_check check (foto_crlv_status in ('em_analise','aprovado','reprovado')),
  add constraint entregadores_foto_comprovante_residencia_status_check check (foto_comprovante_residencia_status in ('em_analise','aprovado','reprovado')),
  add constraint entregadores_foto_placa_status_check check (foto_placa_status in ('em_analise','aprovado','reprovado'));

-- Backfill CRÍTICO: sem isso, todo entregador já aprovado hoje (227 em
-- produção em 2026-09-08) nasceria com os 5 documentos em 'em_analise' e
-- ficaria trancado fora do app no próximo login — o gate novo checa os 5
-- diretamente, não confia em aprovado/status_cadastro sozinho. Só marca
-- 'aprovado' quem já está aprovado hoje; quem está em análise/reprovado
-- continua em_analise nos 5 (correto — ninguém aprovou documento nenhum
-- dele ainda, de verdade).
update public.entregadores
set foto_perfil_status = 'aprovado',
    foto_cnh_status = 'aprovado',
    foto_crlv_status = 'aprovado',
    foto_comprovante_residencia_status = 'aprovado',
    foto_placa_status = 'aprovado'
where aprovado = true or status_cadastro = 'aprovado';
