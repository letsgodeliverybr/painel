-- Desfaz migrations/ifood_codigo_entrega_exigido.sql. Publicar antes as
-- versões anteriores de ifood-polling e ifood-status-sync (elas gravam
-- essa coluna ao receber o DDCR).
alter table public.pedidos
  drop column if exists ifood_codigo_entrega_exigido_em;
