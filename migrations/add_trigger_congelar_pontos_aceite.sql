-- O trigger que congelar_pontos_aceite() sempre precisou pra rodar nunca
-- existiu em produção. add_pontos_progressivos.sql (05/07) presumia estar
-- criando ele pela primeira vez, e add_pontos_semana_agregacao.sql (05/07,
-- mesmo dia) presumia que ele já existia de antes — nenhum dos dois de fato
-- resultou num trigger vivo em `pedidos` (confirmado consultando pg_trigger
-- direto no banco em auditoria de 2026-08-22: zero resultado pra qualquer
-- trigger apontando pra essa function). Efeito: Ranking Entregador sempre
-- mostrou 0 pra todo mundo — pontos_semana é resetado toda segunda pelo
-- cron reset_pontos_semana (esse sim rodando certinho), mas nada nunca
-- alimentava a coluna de volta.
--
-- A function em si já está correta no banco (já soma em
-- entregadores.pontos_semana/pontos_total, ver seu corpo com
-- pg_get_functiondef) — só faltava esse CREATE TRIGGER.
--
-- SEM backfill nesta migration (decisão confirmada com o usuário) — só
-- conta pontos de entregas aceitas a partir de agora, não retroativo.
DROP TRIGGER IF EXISTS trg_congelar_pontos_aceite ON public.pedidos;

CREATE TRIGGER trg_congelar_pontos_aceite
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.congelar_pontos_aceite();
