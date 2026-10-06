-- Limpeza dos pedidos de TESTE do Open Delivery (pedidos.od_teste = true).
-- NÃO roda sozinho: só depois dos testes e com aprovação. Pedidos reais nunca
-- são tocados (filtro od_teste). Passo 1 é reversível; passo 2 (apagar) não.
-- Passo 1 — cancelar os que não estão cancelados (some do mapa e de qualquer conta):
UPDATE public.pedidos
   SET status = 'cancelado', status_detalhado = 'cancelado', motoboy_id = NULL, entregador_id = NULL,
       updated_at = (now() AT TIME ZONE 'America/Sao_Paulo')
 WHERE od_teste AND origem = 'open_delivery' AND status <> 'cancelado';
-- Passo 2 (opcional, irreversível) — apagar de vez (eventos e vínculos vão junto):
-- DELETE FROM public.pedidos WHERE od_teste AND origem = 'open_delivery';
