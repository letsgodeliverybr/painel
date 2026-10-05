-- OPEN DELIVERY v1.7.1 — ETAPA 1 (banco). PROPOSTA 2026-10-06, NÃO APLICADA.
-- Rollback: rollback_od_etapa1_banco.sql
-- Let's Go como operador logístico. Só cria tabelas/colunas NOVAS; não
-- altera dado nenhum nem as funções do iFood. Nenhuma tabela nova é lida ou
-- gravada pela chave pública: RLS ligado, sem política, e privilégios
-- revogados de anon/authenticated — só a função de servidor (service role)
-- acessa. O secret de cada credencial fica no Vault do Supabase (cifrado);
-- aqui só o id do Vault e um hash SHA-256 para conferir no /oauth/token.
BEGIN;

-- 1. Credenciais por loja
CREATE TABLE public.od_credenciais (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id               uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  client_id             text NOT NULL UNIQUE,
  secret_vault_id       uuid NOT NULL,                 -- vault.secrets.id (secret cifrado; usado para assinar o webhook)
  secret_hash           text NOT NULL,                 -- sha256 hex do secret (conferência no /oauth/token)
  webhook_url           text CHECK (webhook_url IS NULL OR webhook_url ~ '^https://'),
  parceiro_merchant_id  text,                          -- MerchantId do sistema do parceiro (X-App-MerchantId)
  parceiro_app_id       text,                          -- AppId do parceiro
  ativo                 boolean NOT NULL DEFAULT true,
  revogado_em           timestamptz,
  revogado_por          text,
  limite_pedidos_dia    integer NOT NULL DEFAULT 300 CHECK (limite_pedidos_dia > 0),
  limite_tokens_min     integer NOT NULL DEFAULT 20  CHECK (limite_tokens_min > 0),
  criado_em             timestamptz NOT NULL DEFAULT now(),
  criado_por            text
);
-- no máximo UMA credencial ativa por loja (trocar = revogar a antiga e criar outra)
CREATE UNIQUE INDEX uq_od_credencial_ativa_loja ON public.od_credenciais (loja_id)
  WHERE ativo AND revogado_em IS NULL;

-- 2. Tokens (só o hash; validade curta; sem refresh)
CREATE TABLE public.od_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    text NOT NULL UNIQUE,                  -- sha256 hex do access_token
  credencial_id uuid NOT NULL REFERENCES public.od_credenciais(id) ON DELETE CASCADE,
  loja_id       uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  expira_em     timestamptz NOT NULL,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_od_tokens_expira ON public.od_tokens (expira_em);
CREATE INDEX idx_od_tokens_credencial_criado ON public.od_tokens (credencial_id, criado_em); -- rate limit

-- 3. Pedidos: vínculo com o pedido do parceiro
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS od_order_id text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS od_delivery_id uuid;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS od_credencial_id uuid REFERENCES public.od_credenciais(id) ON DELETE SET NULL;
-- idempotência: o mesmo orderId do parceiro nunca vira dois pedidos na mesma loja
CREATE UNIQUE INDEX uq_pedidos_od_order_loja ON public.pedidos (loja_id, od_order_id) WHERE od_order_id IS NOT NULL;
CREATE UNIQUE INDEX uq_pedidos_od_delivery ON public.pedidos (od_delivery_id) WHERE od_delivery_id IS NOT NULL;
-- origem 'open_delivery' não precisa de constraint (pedidos.origem não tem CHECK hoje)

-- 4. Fila de eventos do webhook /deliveryEvent
CREATE TABLE public.od_eventos (
  id                 bigserial PRIMARY KEY,
  pedido_id          uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  credencial_id      uuid NOT NULL REFERENCES public.od_credenciais(id) ON DELETE CASCADE,
  loja_id            uuid NOT NULL,
  evento             text NOT NULL CHECK (evento IN ('PENDING','ACCEPTED','REJECTED','PICKUP_ONGOING','ARRIVED_AT_MERCHANT',
                       'ORDER_PICKED','DELIVERY_ONGOING','ARRIVED_AT_CUSTOMER','ORDER_DELIVERED',
                       'RETURNING_TO_MERCHANT','RETURNED_TO_MERCHANT','DELIVERY_FINISHED','CANCELLED')),
  seq                integer NOT NULL,                 -- ordem do evento dentro do pedido (1, 2, 3…)
  payload            jsonb NOT NULL,
  status             text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviando','enviado','falhou','descartado')),
  tentativas         integer NOT NULL DEFAULT 0,
  proxima_tentativa  timestamptz NOT NULL DEFAULT now(),
  ultimo_http        integer,
  ultimo_erro        text,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  enviado_em         timestamptz,
  UNIQUE (pedido_id, evento),                          -- nunca duplica o mesmo evento do mesmo pedido
  UNIQUE (pedido_id, seq)                              -- ordem única por pedido
);
CREATE INDEX idx_od_eventos_fila ON public.od_eventos (proxima_tentativa) WHERE status IN ('pendente','falhou');

-- 5. Log de acessos à API
CREATE TABLE public.od_acessos (
  id            bigserial PRIMARY KEY,
  credencial_id uuid,
  loja_id       uuid,
  rota          text NOT NULL,
  metodo        text NOT NULL,
  http_status   integer NOT NULL,
  ip            text,
  detalhe       text,                                  -- nunca credencial/token
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_od_acessos_cred_criado ON public.od_acessos (credencial_id, criado_em);

-- 6. Fechado para a chave pública
ALTER TABLE public.od_credenciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.od_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.od_eventos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.od_acessos     ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.od_credenciais, public.od_tokens, public.od_eventos, public.od_acessos FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.od_eventos_id_seq, public.od_acessos_id_seq FROM anon, authenticated;
COMMIT;
