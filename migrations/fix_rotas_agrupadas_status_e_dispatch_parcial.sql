-- BUG 1 (produção): pedido em broadcast geral "sumia" depois de ~1-2min sem
-- ser aceito por ninguém, e sem cancelamento/alocação. Rastreado até a
-- Edge Function despacho-engine (supabase/functions/despacho-engine/index.ts),
-- que roda a cada minuto via cron (jobid 2, despacho-engine-cron).
--
-- Dois bugs na mesma function:
--
-- 1. rotas_agrupadas.status tem CHECK constraint restrita a
--    'pendente' | 'aceita' | 'em_rota' | 'finalizada' | 'cancelada', mas o
--    código tentava gravar 'fechada' e 'despachada' — valores que não
--    existem na constraint. O UPDATE falhava sempre, e como o código não
--    checava `error` do supabase-js, falhava em silêncio: toda rota_agrupada
--    ficava presa em 'pendente' pra sempre, mesmo já resolvida.
--    Corrigido no código: 'fechada' -> 'cancelada', 'despachada' -> 'aceita'.
--
-- 2. Quando uma rota agrupada (2+ pedidos da mesma loja, próximos e criados
--    dentro da janela de tempo do roteirizador) tinha todos os pedidos
--    prontos ao mesmo tempo, o despacho só criava despacho_fila para
--    pedidoIds[0] — o primeiro pedido do array, hardcoded. Os demais nunca
--    recebiam despacho_fila (logo, nunca notificavam ninguém) e, por
--    continuarem com rota_agrupada_id preenchido, ficavam de fora do loop de
--    despacho individual também — limbo permanente, sem qualquer caminho de
--    saída. Corrigido: agora itera por todos os pedidoIds do grupo.
--
-- Adicionalmente, um problema separado e mais antigo foi descoberto durante
-- a investigação: o cron despacho-engine-cron vinha autenticando com uma
-- service_role JWT desatualizada (rejeitada pelo gateway com
-- UNAUTHORIZED_LEGACY_JWT) desde a rotação de chaves de 2026-05-25 — ou
-- seja, a function inteira (incluindo o roteirizador) estava inerte há mais
-- de 6 semanas, sem que pg_cron acusasse erro algum (pg_net é fire-and-
-- forget: cron.job_run_details sempre mostra "succeeded", mesmo quando a
-- chamada HTTP real falha). Corrigido diretamente em produção via
-- cron.alter_job(job_id := 2, command := ...) apontando pra uma secret key
-- válida — não incluído aqui por conter uma credencial sensível.
--
-- Limpeza feita nas 7 rotas_agrupadas que já estavam presas em 'pendente'
-- desde 26/06: todos os 14 pedidos referenciados já estavam em estado
-- terminal (finalizado/cancelado), então foram apenas marcadas com o status
-- final correspondente ('finalizada' se algum pedido do grupo foi
-- finalizado, senão 'cancelada'). Nenhum pedido "vivo" foi afetado.
--
-- Fix completo do código em supabase/functions/despacho-engine/index.ts
-- (deploy feito via `supabase functions deploy despacho-engine`).

update public.rotas_agrupadas r
set status = case
  when exists (
    select 1 from unnest(r.pedido_ids) pid
    join public.pedidos p on p.id = pid
    where p.status = 'finalizado'
  ) then 'finalizada'
  else 'cancelada'
end
where r.status = 'pendente';
