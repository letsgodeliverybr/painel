-- Reaplica a correção de auto_pronto_pedidos() que não persistiu da primeira
-- vez (mesmo padrão de hoje com pontos_base/km_adicional_valor — precisou
-- confirmar com pg_get_functiondef e rodar de novo).
--
-- Bug: a condição original só olhava (status = 'recebido' OR
-- status_detalhado = 'recebido'), então um pedido com status='aceito' mas
-- status_detalhado ainda em 'recebido' (ou vice-versa, campos dessincronizados)
-- batia na condição via OR e era revertido pra 'pronto' pelo job automático,
-- mesmo já tendo motoboy/entregador aceito — pedido some da tela do motoboy.
--
-- Fix: mantém a condição original (não altera comportamento pra pedidos
-- genuinamente 'recebido' nos dois campos), e adiciona exclusão explícita
-- dos status avançados em AMBAS as colunas (status e status_detalhado),
-- fechando o caso de campos dessincronizados. Resto da função idêntico ao
-- que já existe (mesmo SET, mesmo INTERVAL '1 minute').

CREATE OR REPLACE FUNCTION public.auto_pronto_pedidos()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.pedidos
  SET
    status = 'pronto',
    status_detalhado = 'pronto',
    pronto_em = NOW(),
    updated_at = NOW()
  WHERE
    (status = 'recebido' OR status_detalhado = 'recebido')
    AND status NOT IN ('aceito','no_local','chegou_local','em_rota','chegou_destino','retornando','finalizado','cancelado')
    AND status_detalhado NOT IN ('aceito','no_local','chegou_local','em_rota','chegou_destino','retornando','finalizado','cancelado')
    AND recebido_em IS NOT NULL
    AND recebido_em <= NOW() - INTERVAL '1 minute';
END;
$function$;
