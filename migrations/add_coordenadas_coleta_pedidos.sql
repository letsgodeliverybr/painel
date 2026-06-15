-- Coordenadas geocodificadas do endereço de coleta externo.
-- Usadas para calcular distancia_km como coleta→entrega em vez de loja→entrega.
-- Execute no SQL Editor do Supabase Studio.

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS latitude_coleta double precision;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS longitude_coleta double precision;
