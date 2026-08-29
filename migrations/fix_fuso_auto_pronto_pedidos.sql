-- Bug real, confirmado com dados de produção (leitura, nada alterado):
--
--   pedido #002 (43e5e736…): created_at 13:17:51, aceito_em 13:19:11,
--   pronto_em 16:18:00 — 3h à frente do que faz sentido pra um pedido já
--   aceito 1min depois de criado.
--   pedido #6074 (88e8a242…): created_at 11:07:43, aceito_em 11:08:17,
--   pronto_em 14:08:00 — mesmo padrão, +3h.
--
-- Causa raiz: auto_pronto_pedidos() (fix_auto_pronto_pedidos_status_avancado.sql)
-- grava `pronto_em = NOW()` e `updated_at = NOW()` sem converter fuso.
-- NOW() é timestamptz; ao ser atribuído numa coluna timestamp SEM fuso
-- (mesmo tipo de created_at/aceito_em/updated_at em toda a tabela pedidos),
-- o Postgres converte usando o fuso da SESSÃO (aqui, UTC) — enquanto todo
-- o resto do código (app.js) grava esses timestamps já em hora LOCAL de
-- Brasília antes de mandar pro banco. Resultado: pronto_em desta função sai
-- 3h à frente do que deveria, e qualquer leitura que trate a coluna como
-- "já é local" (ex: _parseUtc em app.js, ou a tela de "Previsão" que soma
-- 30min a partir de pronto_em) empurra a previsão ~3h a mais do que devia
-- — exatamente o bug relatado ("30min esperado, mostrando ~196min").
--
-- Mesmo padrão já corrigido antes em outra function deste mesmo projeto
-- (fix_fuso_calculo_pontos_progressivos.sql, linha
-- `now() AT TIME ZONE 'America/Sao_Paulo'`) — aplica o idêntico aqui.
--
-- Bug SEPARADO, achado no caminho, também corrigido aqui: a condição
-- `recebido_em <= NOW() - INTERVAL '1 minute'` tem o MESMO problema — como
-- NOW() (session tz) sai ~3h à frente de recebido_em (Brasília local), a
-- comparação sempre bate como "já passou 1 minuto" quase que
-- imediatamente depois de um pedido ser recebido, nunca respeitando a
-- espera de 1 minuto de verdade. Corrigido junto com o AT TIME ZONE.
CREATE OR REPLACE FUNCTION public.auto_pronto_pedidos()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.pedidos
  SET
    status = 'pronto',
    status_detalhado = 'pronto',
    pronto_em = (NOW() AT TIME ZONE 'America/Sao_Paulo'),
    updated_at = (NOW() AT TIME ZONE 'America/Sao_Paulo')
  WHERE
    (status = 'recebido' OR status_detalhado = 'recebido')
    AND status NOT IN ('aceito','no_local','chegou_local','em_rota','chegou_destino','retornando','finalizado','cancelado')
    AND status_detalhado NOT IN ('aceito','no_local','chegou_local','em_rota','chegou_destino','retornando','finalizado','cancelado')
    AND recebido_em IS NOT NULL
    AND recebido_em <= (NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 minute';
END;
$function$;
