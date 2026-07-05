-- Vagas de Motoboy Fixo — reformulação completa (dados reais, sem mock).
-- Usado na nova aba "Vagas Disponíveis" do painel (visível pra adm/loja/suporte).
--
-- valor é calculado no client antes do insert (30 ou 40, conforme dia da
-- semana / feriados_importantes) e nunca é editado depois — não recalcula
-- retroativamente se um feriado for cadastrado depois da vaga já criada.
--
-- Sem RLS, mesmo padrão de toda tabela nova criada nessa sessão
-- (creditos_lojas, contas_pagar) — isolamento por loja feito no client via
-- _lojaFiltro(), como já é hoje em pedidos/creditos_lojas.

CREATE TABLE IF NOT EXISTS public.vagas_motoboy_fixo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  data date NOT NULL,
  endereco text NOT NULL,
  horario_inicio time NOT NULL,
  horario_fim time NOT NULL,
  valor numeric NOT NULL,
  status text NOT NULL DEFAULT 'disponivel',
  entregador_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feriados_importantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
