-- Aviso de vaga nova de Entrega Dedicada (Tarefa D, 2026-09-29).
--
-- Vaga criada com status 'disponivel' → push "Nova vaga disponível" pros
-- entregadores elegíveis (ver entregadores_para_vaga), com o MESMO canal/som/
-- vibração do alerta de pedido novo no app (tipo 'nova_vaga').
--
-- Gatilho AFTER INSERT (vale pra qualquer origem: painel, SQL, futuro app da
-- loja). Uma vez só por vaga: só INSERT dispara (editar ou reabrir por
-- desatribuição são UPDATE) e a notify-vaga ainda marca aviso_nova_enviado_em
-- de forma atômica antes de enviar — chamada repetida não reenvia.
--
-- DEPENDE de bloqueio_entregador_por_loja.sql (tabela
-- loja_entregadores_bloqueados) — aplicar depois dela.
--
-- O envio fica DESLIGADO até existir configuracoes.vaga_nova_push_ativo =
-- 'true': o app publicado hoje não conhece o tipo 'nova_vaga' e cairia no
-- alarme de pedido com texto de pedido. Ligar só depois do AAB novo no ar.
--
-- Rollback: migrations/rollback_aviso_vaga_nova.sql

BEGIN;

ALTER TABLE public.vagas_motoboy_fixo ADD COLUMN IF NOT EXISTS aviso_nova_enviado_em timestamptz;

-- Elegíveis: online (disponivel), não bloqueado na plataforma, de moto
-- (vaga fixa é só moto, mesma regra do app/painel), dentro do raio da loja
-- (despacho_raio_busca_km, mesma config do despacho), respeitando clã, NÃO
-- bloqueado nessa loja e sem vaga preenchida no mesmo dia com horário que se
-- sobrepõe. Diferente de entregadores_no_raio, NÃO exclui quem está no meio
-- de uma entrega — vaga é pra outro dia/horário, não uma oferta imediata.
CREATE OR REPLACE FUNCTION public.entregadores_para_vaga(p_vaga_id uuid)
RETURNS TABLE(id uuid, nome text, fcm_token text, distancia_km double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH v AS (
    SELECT vg.id, vg.loja_id, vg.data, vg.horario_inicio, vg.horario_fim,
           l.latitude::double precision AS lat, l.longitude::double precision AS lng,
           coalesce(nullif((SELECT c.valor FROM public.configuracoes c WHERE c.chave = 'despacho_raio_busca_km' LIMIT 1), '')::double precision, 32) AS raio
    FROM public.vagas_motoboy_fixo vg
    JOIN public.lojas l ON l.id = vg.loja_id
    WHERE vg.id = p_vaga_id AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL
  ), d AS (
    SELECT e.id, e.nome, e.fcm_token,
      (6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(v.lat)) * cos(radians(e.lat)) *
        cos(radians(e.lng) - radians(v.lng)) +
        sin(radians(v.lat)) * sin(radians(e.lat))
      )))) AS distancia_km,
      v.raio
    FROM v
    JOIN public.entregadores e ON true
    WHERE e.disponivel = true
      AND e.status IS DISTINCT FROM 'bloqueado'
      AND coalesce(e.modal_veiculo, 'moto') = 'moto'
      AND e.fcm_token IS NOT NULL
      AND e.lat IS NOT NULL AND e.lng IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.loja_entregadores_bloqueados b
                      WHERE b.loja_id = v.loja_id AND b.entregador_id = e.id)
      AND (
        NOT EXISTS (SELECT 1 FROM public.clas_lojas cl WHERE cl.loja_id = v.loja_id)
        OR EXISTS (SELECT 1 FROM public.clas_lojas cl
                   JOIN public.clas_entregadores ce ON ce.cla_id = cl.cla_id
                   WHERE cl.loja_id = v.loja_id AND ce.entregador_id = e.id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.vagas_motoboy_fixo o
        WHERE o.entregador_id = e.id AND o.status = 'preenchida' AND o.data = v.data
          AND o.horario_inicio < v.horario_fim AND v.horario_inicio < o.horario_fim
      )
  )
  SELECT id, nome, fcm_token, distancia_km FROM d WHERE distancia_km <= raio ORDER BY distancia_km;
$$;
-- lista fcm_token: só o service_role (edge function) chama.
REVOKE EXECUTE ON FUNCTION public.entregadores_para_vaga(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_aviso_vaga_nova()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'disponivel' AND NEW.entregador_id IS NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/notify-vaga',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', 'letsgo2026secret'),
        body := jsonb_build_object('vaga_id', NEW.id, 'acao', 'nova')
      );
    EXCEPTION WHEN OTHERS THEN
      -- aviso nunca pode impedir a criação da vaga
      RAISE WARNING 'fn_aviso_vaga_nova: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_aviso_vaga_nova() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tg_aviso_vaga_nova
  AFTER INSERT ON public.vagas_motoboy_fixo
  FOR EACH ROW EXECUTE FUNCTION public.fn_aviso_vaga_nova();

COMMIT;
