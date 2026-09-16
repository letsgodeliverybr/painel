-- iFood manda o método de pagamento em inglês (CREDIT, DEBIT,
-- MEAL_VOUCHER, FOOD_VOUCHER, CASH, PIX, OTHER — Order API pública). O
-- código de mapeamento (mapearFormaPagamento em ifood-polling e
-- ifood-status-sync) traduz pra dinheiro/cartao/pix, com fallback 'outro'
-- pra método desconhecido/OTHER — sem isso, pedido com método não mapeado
-- derrubava o upsert inteiro (violava a constraint) e nunca sincronizava.
ALTER TABLE public.pedidos DROP CONSTRAINT pedidos_forma_pagamento_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_forma_pagamento_check
  CHECK (forma_pagamento = ANY (ARRAY['dinheiro'::text, 'cartao'::text, 'pix'::text, 'outro'::text]));
