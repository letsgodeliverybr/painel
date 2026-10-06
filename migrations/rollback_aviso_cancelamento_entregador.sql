-- Desfaz migrations/aviso_cancelamento_entregador.sql. Pedidos cancelados
-- enquanto ele esteve ativo ficam com motoboy_id vazio e o entregador em
-- entregador_id (os relatórios continuam mostrando quem era).
BEGIN;
DROP TRIGGER IF EXISTS tg_cancelado_solta_entregador ON public.pedidos;
DROP FUNCTION IF EXISTS public.fn_cancelado_solta_entregador();
COMMIT;
