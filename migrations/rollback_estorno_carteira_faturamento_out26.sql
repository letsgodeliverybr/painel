-- Desfaz migrations/estorno_carteira_faturamento_out26.sql: apaga só os ajustes
-- de out/26 (o texto "em out/26" diferencia do zeramento de 30/09).
BEGIN;
DELETE FROM public.creditos_lojas
 WHERE origem = 'ajuste_zerar_faturamento'
   AND observacoes LIKE '%gravados indevidamente em out/26%';
COMMIT;
