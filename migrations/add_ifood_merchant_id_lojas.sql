-- Pedidos vindos do iFood (webhook e polling) não tinham loja_id nenhum
-- gravado, e endereco_coleta/latitude_coleta/longitude_coleta ficavam
-- sempre vazios — o payload do iFood só traz merchant.{id,name}, nunca o
-- endereço da loja (confirmado contra pedido de teste real do Developer
-- Portal, 2026-07-25). A solução é resolver merchant.id pro nosso próprio
-- cadastro em `lojas` e puxar endereco/latitude/longitude de lá — pra isso
-- precisamos de onde guardar esse merchant_id por loja.
--
-- Índice único parcial (só quando não-nulo): impede a mesma loja iFood
-- ficar mapeada sem querer pra 2 lojas nossas diferentes, mas não afeta
-- lojas que ainda não têm integração com iFood (a maioria, hoje).
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS ifood_merchant_id text;
CREATE UNIQUE INDEX IF NOT EXISTS lojas_ifood_merchant_id_idx
  ON public.lojas(ifood_merchant_id) WHERE ifood_merchant_id IS NOT NULL;
