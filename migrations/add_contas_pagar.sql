-- Contas a pagar: despesas administrativas do escritório (aluguel, internet,
-- salário, contador, marketing, etc.), separadas das despesas operacionais de
-- entrega (taxa_motoboy). Usada na sub-aba "Contas a Pagar" (Financeiro) e no
-- cálculo de Lucro Líquido na tela "📦 Pedidos".
--
-- Sem RLS, mesmo padrão de creditos_lojas/cobrancas_lojas/saques — o painel
-- acessa tudo com a anon key estática, sem JWT por usuário.

CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL,
  descricao text NOT NULL,
  categoria text NOT NULL,
  valor numeric NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  vencimento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
