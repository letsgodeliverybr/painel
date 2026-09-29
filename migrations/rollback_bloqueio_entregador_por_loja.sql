-- Rollback de bloqueio_entregador_por_loja.sql.
-- ATENÇÃO: apaga o histórico de bloqueio automático na plataforma
-- (entregadores_bloqueio_plataforma). Os bloqueios por loja continuam na
-- tabela (renomeada de volta), só deixam de ter efeito. Entregadores já
-- bloqueados na plataforma continuam com status='bloqueado' — desbloquear
-- pelo painel se for o caso.
BEGIN;

DROP TRIGGER IF EXISTS tg_00_bloqueio_loja_pedido ON public.pedidos;
DROP TRIGGER IF EXISTS tg_00_bloqueio_loja_despacho_fila ON public.despacho_fila;
DROP TRIGGER IF EXISTS tg_apos_bloqueio_loja ON public.loja_entregadores_bloqueados;
DROP TRIGGER IF EXISTS tg_reverter_bloqueio_plataforma ON public.entregadores;
DROP FUNCTION IF EXISTS public.fn_bloqueio_loja_pedido();
DROP FUNCTION IF EXISTS public.fn_bloqueio_loja_despacho_fila();
DROP FUNCTION IF EXISTS public.fn_apos_bloqueio_loja();
DROP FUNCTION IF EXISTS public.fn_reverter_bloqueio_plataforma();
DROP FUNCTION IF EXISTS public.listar_bloqueios_loja(uuid);
DROP FUNCTION IF EXISTS public.salvar_bloqueios_loja(uuid, uuid[], text);
DROP FUNCTION IF EXISTS public.bloqueios_plataforma_ativos();

-- entregadores_no_raio de volta ao corpo anterior (sem os filtros de bloqueio)
CREATE OR REPLACE FUNCTION public.entregadores_no_raio(p_lat double precision, p_lng double precision, p_raio_km double precision, p_loja_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, nome text, distancia_km double precision)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    e.id,
    e.nome,
    (6371 * acos(LEAST(1, GREATEST(-1,
      cos(radians(p_lat)) * cos(radians(e.lat)) *
      cos(radians(e.lng) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(e.lat))
    )))) AS distancia_km
  FROM entregadores e
  WHERE e.disponivel = true
    AND e.em_processo = false
    AND e.lat IS NOT NULL
    AND e.lng IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE (p.motoboy_id = e.id OR p.entregador_id = e.id)
        AND p.status IN ('aceito', 'no_local', 'chegou_local', 'em_rota', 'chegou_destino', 'retornando')
    )
    AND (
      -- p_loja_id NULL (chamador não informou) ou loja sem clã: sem
      -- restrição, comportamento idêntico ao de antes desta migration.
      NOT EXISTS (SELECT 1 FROM public.clas_lojas cl WHERE cl.loja_id = p_loja_id)
      OR EXISTS (
        SELECT 1 FROM public.clas_lojas cl
        JOIN public.clas_entregadores ce ON ce.cla_id = cl.cla_id
        WHERE cl.loja_id = p_loja_id AND ce.entregador_id = e.id
      )
    )
    AND (6371 * acos(LEAST(1, GREATEST(-1,
      cos(radians(p_lat)) * cos(radians(e.lat)) *
      cos(radians(e.lng) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(e.lat))
    )))) <= p_raio_km
  ORDER BY distancia_km ASC;
$function$;

DROP FUNCTION IF EXISTS public.entregador_bloqueado_na_loja(uuid, uuid);
DROP TABLE IF EXISTS public.entregadores_bloqueio_plataforma;

DROP POLICY IF EXISTS "entregador le os proprios bloqueios" ON public.loja_entregadores_bloqueados;
ALTER TABLE public.loja_entregadores_bloqueados DISABLE ROW LEVEL SECURITY;
DROP INDEX IF EXISTS public.idx_loja_ent_bloq_entregador;
ALTER TABLE public.loja_entregadores_bloqueados DROP COLUMN IF EXISTS criado_por;
ALTER TABLE public.loja_entregadores_bloqueados RENAME COLUMN criado_em TO created_at;
ALTER TABLE public.loja_entregadores_bloqueados RENAME TO entregadores_bloqueados_loja;

COMMIT;
