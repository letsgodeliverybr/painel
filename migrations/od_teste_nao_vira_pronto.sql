-- Pedido de TESTE (od_teste=true) nunca vira 'pronto'. PROPOSTA 2026-10-06, NÃO APLICADA.
-- Rollback: rollback_od_teste_nao_vira_pronto.sql
-- Motivo: o auto-pronto do PAINEL (processarAutoPronto, app.js) marca como
-- 'pronto' todo 'recebido' com mais de 60 s, usando created_at quando não há
-- recebido_em — furou o modo teste (pedido do teste das 13:43 virou pronto e
-- foi aceito). 'pronto' é o que expõe o pedido aos entregadores.
-- Defesa no banco (vale para qualquer caminho: auto-pronto do painel, botão
-- "pronto", app, outra função): se o pedido é de teste e alguém tenta
-- passá-lo para 'pronto', o banco mantém o status anterior (sem erro, para o
-- painel não ficar repetindo erro a cada 5 s). Todas as outras mudanças pelo
-- seletor (aceito, chegou à loja, em rota, chegou ao destino, finalizado,
-- cancelado) continuam livres, para testar os webhooks.
-- Pedidos com od_teste=false (todos os de iFood, painel, app e Open Delivery
-- em produção) não são tocados.
BEGIN;
CREATE OR REPLACE FUNCTION public.fn_od_teste_nao_vira_pronto() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.od_teste AND (NEW.status = 'pronto' OR NEW.status_detalhado = 'pronto')
     AND OLD.status IS DISTINCT FROM 'pronto' THEN
    NEW.status := OLD.status;
    NEW.status_detalhado := OLD.status_detalhado;
    NEW.pronto_em := OLD.pronto_em;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_od_teste_nao_vira_pronto ON public.pedidos;
-- nome escolhido para rodar ANTES de tg_reset_motoboy_on_pronto (ordem alfabética
-- dos gatilhos BEFORE): o status já volta ao anterior e o entregador não é limpo.
CREATE TRIGGER tg_od_teste_nao_vira_pronto BEFORE UPDATE ON public.pedidos
  FOR EACH ROW WHEN (NEW.od_teste) EXECUTE FUNCTION public.fn_od_teste_nao_vira_pronto();
COMMIT;
