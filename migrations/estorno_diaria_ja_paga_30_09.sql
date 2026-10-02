-- Estorno da diária de 30/09 do Gabriel Eliziário (R$ 30), que já tinha sido
-- paga por fora (decisão do usuário em 2026-10-02). Mantém o crédito
-- "Diária Finalizada - @PEDELETSGO" e o histórico; só lança o débito.
-- vaga_id preenchido: ocupa a vaga de estorno dessa diária no índice único
-- (vaga_id, tipo), então um cancelamento futuro da vaga não estorna de novo.
-- Rollback: rollback_estorno_diaria_ja_paga_30_09.sql
INSERT INTO public.creditos_entregadores (entregador_id, tipo, valor, observacoes, data, vaga_id, created_at, updated_at)
VALUES ('8ee06688-0f13-4cf5-9629-d66caa246894', 'debito', 30, 'Estorno De Diária - Já Paga', '2026-09-30',
        '8c405b4f-c286-40d3-aa8e-4f3e190426dc', now(), now())
ON CONFLICT (vaga_id, tipo) WHERE vaga_id IS NOT NULL DO NOTHING;
