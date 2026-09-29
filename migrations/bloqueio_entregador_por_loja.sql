-- Bloqueio de entregador por loja (Tarefa C, 2026-09-29).
--
-- Regra: entregador bloqueado por uma loja (Editar Loja → "Entregador
-- bloqueado") NÃO recebe pedido dessa loja de forma nenhuma — despacho,
-- push, oferta em despacho_fila, aceite pelo app, alocação/realocação manual
-- pelo painel. A trava de verdade fica AQUI no banco (gatilhos), não na tela:
-- o app e o painel gravam direto em pedidos/despacho_fila.
--
-- 3 lojas DIFERENTES bloqueando o mesmo entregador → bloqueio na plataforma
-- (entregadores.status='bloqueado', mesmo estado que o botão "Bloqueado" do
-- admin grava), com motivo/lojas/data em entregadores_bloqueio_plataforma.
-- Remover um bloqueio de loja NÃO desbloqueia da plataforma; o admin reverte
-- pelo botão de sempre (e o registro é marcado como revertido).
--
-- RLS: nenhuma política ampla. O app do entregador (Supabase Auth real) só lê
-- os PRÓPRIOS bloqueios. O painel (sem Auth real — Fase 1 de segurança
-- pendente) lê/grava só pelas funções SECURITY DEFINER abaixo.
--
-- Rollback: migrations/rollback_bloqueio_entregador_por_loja.sql

BEGIN;

-- ── 1. Tabela de bloqueios por loja ────────────────────────────────────────
-- Reaproveita entregadores_bloqueados_loja (protótipo abandonado, 0 linhas,
-- nenhum código usa — ver migrations/add_clas_entregador.sql), renomeada pro
-- nome proposto. Já tem PK, UNIQUE(loja_id, entregador_id) e FKs com
-- ON DELETE CASCADE pra lojas e entregadores.
ALTER TABLE public.entregadores_bloqueados_loja RENAME TO loja_entregadores_bloqueados;
ALTER TABLE public.loja_entregadores_bloqueados RENAME COLUMN created_at TO criado_em;
ALTER TABLE public.loja_entregadores_bloqueados ADD COLUMN criado_por text;
CREATE INDEX IF NOT EXISTS idx_loja_ent_bloq_entregador ON public.loja_entregadores_bloqueados (entregador_id);

-- Estava com RLS DESLIGADO (qualquer um com a chave anon lia/gravava).
ALTER TABLE public.loja_entregadores_bloqueados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entregador le os proprios bloqueios" ON public.loja_entregadores_bloqueados
  FOR SELECT TO authenticated USING (entregador_id = auth.uid());

-- ── 2. Registro do bloqueio automático na plataforma ───────────────────────
CREATE TABLE public.entregadores_bloqueio_plataforma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entregador_id uuid NOT NULL REFERENCES public.entregadores(id) ON DELETE CASCADE,
  motivo text NOT NULL,
  lojas uuid[] NOT NULL,
  lojas_nomes text[] NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  revertido_em timestamptz
);
CREATE INDEX idx_ent_bloq_plat_entregador ON public.entregadores_bloqueio_plataforma (entregador_id) WHERE revertido_em IS NULL;
ALTER TABLE public.entregadores_bloqueio_plataforma ENABLE ROW LEVEL SECURITY;
-- sem política: só as funções abaixo (SECURITY DEFINER) leem/gravam.

-- ── 3. Checagem central ────────────────────────────────────────────────────
-- SECURITY DEFINER de propósito: os gatilhos rodam com o papel de quem
-- grava (anon no painel), que não enxerga a tabela por causa do RLS — sem
-- isso a checagem daria "não bloqueado" pro painel.
CREATE OR REPLACE FUNCTION public.entregador_bloqueado_na_loja(p_entregador_id uuid, p_loja_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_entregador_id IS NOT NULL AND p_loja_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.loja_entregadores_bloqueados b
    WHERE b.loja_id = p_loja_id AND b.entregador_id = p_entregador_id
  );
$$;

-- ── 4. (a) entregadores_no_raio: exclui bloqueado na loja ──────────────────
-- Todas as 4 chamadas do despacho-engine (rota, modo todos, onda 1, ondas
-- seguintes) passam por aqui com p_loja_id. Corpo idêntico ao atual +
-- os dois filtros marcados com "bloqueio".
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
    -- bloqueio na plataforma: não depender só de disponivel=false
    AND e.status IS DISTINCT FROM 'bloqueado'
    -- bloqueio por loja
    AND NOT EXISTS (
      SELECT 1 FROM public.loja_entregadores_bloqueados b
      WHERE b.loja_id = p_loja_id AND b.entregador_id = e.id
    )
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

-- ── 5. (d) + (b') pedidos: recusa atribuir a entregador bloqueado ──────────
-- Cobre aceite pelo app (3 telas), alocação manual do painel e realocação
-- manual (fn_intercept_realocacao_manual → notify-pedido-realocado). Só
-- checa quando o entregador MUDA — bloquear alguém no meio de uma entrega
-- já aceita não trava as atualizações de status dessa entrega.
-- Nome "tg_00_..." de propósito: gatilhos BEFORE rodam em ordem alfabética,
-- este precisa rodar ANTES de tg_intercept_realocacao_manual (que cria
-- oferta e dispara push) — a exceção aborta o UPDATE inteiro.
CREATE OR REPLACE FUNCTION public.fn_bloqueio_loja_pedido()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR NEW.motoboy_id IS DISTINCT FROM OLD.motoboy_id)
     AND public.entregador_bloqueado_na_loja(NEW.motoboy_id, NEW.loja_id) THEN
    RAISE EXCEPTION 'ENTREGADOR_BLOQUEADO_NA_LOJA: entregador % bloqueado na loja %', NEW.motoboy_id, NEW.loja_id
      USING HINT = 'Este entregador foi bloqueado por esta loja.';
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.entregador_id IS DISTINCT FROM OLD.entregador_id)
     AND public.entregador_bloqueado_na_loja(NEW.entregador_id, NEW.loja_id) THEN
    RAISE EXCEPTION 'ENTREGADOR_BLOQUEADO_NA_LOJA: entregador % bloqueado na loja %', NEW.entregador_id, NEW.loja_id
      USING HINT = 'Este entregador foi bloqueado por esta loja.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tg_00_bloqueio_loja_pedido
  BEFORE INSERT OR UPDATE OF motoboy_id, entregador_id ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_bloqueio_loja_pedido();

-- ── 6. (e) despacho_fila: não cria oferta pra bloqueado ────────────────────
-- Segunda camada (a primeira é entregadores_no_raio). O despacho-engine
-- passa a só mandar push se a inserção der certo.
CREATE OR REPLACE FUNCTION public.fn_bloqueio_loja_despacho_fila()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.entregador_bloqueado_na_loja(
       NEW.entregador_id,
       (SELECT p.loja_id FROM public.pedidos p WHERE p.id = NEW.pedido_id)) THEN
    RAISE EXCEPTION 'ENTREGADOR_BLOQUEADO_NA_LOJA: oferta recusada (entregador %, pedido %)', NEW.entregador_id, NEW.pedido_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tg_00_bloqueio_loja_despacho_fila
  BEFORE INSERT ON public.despacho_fila
  FOR EACH ROW EXECUTE FUNCTION public.fn_bloqueio_loja_despacho_fila();

-- ── 7. (e) + (4) ao bloquear: expira ofertas e checa as 3 lojas ────────────
CREATE OR REPLACE FUNCTION public.fn_apos_bloqueio_loja()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_lojas uuid[];
  v_nomes text[];
BEGIN
  -- ofertas pendentes desse entregador em pedidos dessa loja
  UPDATE public.despacho_fila f SET status = 'expirado'
  WHERE f.entregador_id = NEW.entregador_id
    AND f.status = 'aguardando'
    AND f.pedido_id IN (SELECT p.id FROM public.pedidos p WHERE p.loja_id = NEW.loja_id);

  -- 3 lojas DIFERENTES (UNIQUE(loja_id, entregador_id) já impede repetir a
  -- mesma loja; count(DISTINCT) por garantia)
  SELECT array_agg(b.loja_id ORDER BY b.criado_em), array_agg(l.nome ORDER BY b.criado_em)
    INTO v_lojas, v_nomes
  FROM public.loja_entregadores_bloqueados b
  JOIN public.lojas l ON l.id = b.loja_id
  WHERE b.entregador_id = NEW.entregador_id;

  IF (SELECT count(DISTINCT x) FROM unnest(v_lojas) x) >= 3
     AND EXISTS (SELECT 1 FROM public.entregadores e
                 WHERE e.id = NEW.entregador_id AND e.status IS DISTINCT FROM 'bloqueado') THEN
    UPDATE public.entregadores
       SET status = 'bloqueado', aprovado = false, disponivel = false, updated_at = now()
     WHERE id = NEW.entregador_id;
    INSERT INTO public.entregadores_bloqueio_plataforma (entregador_id, motivo, lojas, lojas_nomes)
    VALUES (NEW.entregador_id,
            'Bloqueio automático: bloqueado por ' || cardinality(v_lojas) || ' lojas diferentes',
            v_lojas, v_nomes);
    -- bloqueado na plataforma: nenhuma oferta pendente em loja nenhuma
    UPDATE public.despacho_fila SET status = 'expirado'
    WHERE entregador_id = NEW.entregador_id AND status = 'aguardando';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tg_apos_bloqueio_loja
  AFTER INSERT ON public.loja_entregadores_bloqueados
  FOR EACH ROW EXECUTE FUNCTION public.fn_apos_bloqueio_loja();

-- Admin desbloqueou (botão de sempre: status sai de 'bloqueado') → marca o
-- registro automático como revertido. Quem reverteu fica em logs_acoes.
CREATE OR REPLACE FUNCTION public.fn_reverter_bloqueio_plataforma()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'bloqueado' AND NEW.status IS DISTINCT FROM 'bloqueado' THEN
    UPDATE public.entregadores_bloqueio_plataforma
       SET revertido_em = now()
     WHERE entregador_id = NEW.id AND revertido_em IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tg_reverter_bloqueio_plataforma
  AFTER UPDATE OF status ON public.entregadores
  FOR EACH ROW EXECUTE FUNCTION public.fn_reverter_bloqueio_plataforma();

-- ── 8. Funções do painel ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.listar_bloqueios_loja(p_loja_id uuid)
RETURNS TABLE(entregador_id uuid, nome text, telefone text, criado_em timestamptz, criado_por text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.entregador_id, e.nome, e.telefone, b.criado_em, b.criado_por
  FROM public.loja_entregadores_bloqueados b
  JOIN public.entregadores e ON e.id = b.entregador_id
  WHERE b.loja_id = p_loja_id
  ORDER BY e.nome;
$$;

-- Grava a lista completa da loja (o que saiu é removido, o que entrou é
-- inserido e dispara fn_apos_bloqueio_loja). Retorna quem acabou de ser
-- bloqueado na plataforma nesta chamada, pro painel avisar.
CREATE OR REPLACE FUNCTION public.salvar_bloqueios_loja(p_loja_id uuid, p_entregador_ids uuid[], p_criado_por text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ids uuid[] := coalesce(p_entregador_ids, '{}');
  v_removidos int;
  v_adicionados int;
  v_plataforma jsonb;
BEGIN
  IF p_loja_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.lojas WHERE id = p_loja_id) THEN
    RAISE EXCEPTION 'loja inexistente';
  END IF;
  DELETE FROM public.loja_entregadores_bloqueados
   WHERE loja_id = p_loja_id AND NOT (entregador_id = ANY (v_ids));
  GET DIAGNOSTICS v_removidos = ROW_COUNT;
  INSERT INTO public.loja_entregadores_bloqueados (loja_id, entregador_id, criado_por)
  SELECT p_loja_id, x, left(p_criado_por, 200)
  FROM (SELECT DISTINCT unnest(v_ids) x) s
  ON CONFLICT (loja_id, entregador_id) DO NOTHING;
  GET DIAGNOSTICS v_adicionados = ROW_COUNT;
  SELECT coalesce(jsonb_agg(jsonb_build_object('entregador_id', bp.entregador_id, 'nome', e.nome, 'lojas', bp.lojas_nomes)), '[]')
    INTO v_plataforma
  FROM public.entregadores_bloqueio_plataforma bp
  JOIN public.entregadores e ON e.id = bp.entregador_id
  WHERE bp.criado_em = now() AND bp.entregador_id = ANY (v_ids);
  RETURN jsonb_build_object('adicionados', v_adicionados, 'removidos', v_removidos, 'bloqueados_plataforma', v_plataforma);
END;
$$;

-- Bloqueios automáticos ainda valendo (lista de entregadores do painel).
CREATE OR REPLACE FUNCTION public.bloqueios_plataforma_ativos()
RETURNS TABLE(entregador_id uuid, motivo text, lojas_nomes text[], criado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT entregador_id, motivo, lojas_nomes, criado_em
  FROM public.entregadores_bloqueio_plataforma
  WHERE revertido_em IS NULL;
$$;

-- Funções de gatilho não precisam ser chamáveis pela API.
REVOKE EXECUTE ON FUNCTION public.fn_bloqueio_loja_pedido(), public.fn_bloqueio_loja_despacho_fila(),
  public.fn_apos_bloqueio_loja(), public.fn_reverter_bloqueio_plataforma() FROM PUBLIC, anon, authenticated;

COMMIT;
