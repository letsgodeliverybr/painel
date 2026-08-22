-- Clã de Entregador — grupo exclusivo de lojas + entregadores por cidade.
--
-- Não é só agrupamento visual: é regra de despacho. Pedido de uma loja que
-- pertence a um clã só pode ser oferecido automaticamente (despacho-engine)
-- pra entregadores do MESMO clã. Loja sem clã (a maioria hoje): nenhuma
-- mudança de comportamento. Alocação manual do admin (abrirAlocarMotoboy/
-- alocarMotoboy, botão "Alocar Motoboy") não passa por aqui — consulta
-- entregadores direto, sempre foi um caminho separado do despacho-engine —
-- então a exceção "admin pode alocar qualquer um, mesmo fora do clã" já
-- existe de graça, sem precisar de código extra pra isso.
--
-- Cardinalidade 1:1 (loja pertence a no máximo 1 clã, entregador também):
-- UNIQUE em loja_id e em entregador_id nas tabelas de vínculo — decisão
-- confirmada com o usuário, evita ambiguidade de "qual clã vale" se uma
-- loja/entregador pudesse estar em mais de um.
CREATE TABLE IF NOT EXISTS public.clas (
  id uuid primary key default gen_random_uuid(),
  cidade text not null,
  uf text not null,
  created_at timestamptz not null default now(),
  unique(cidade, uf)
);

CREATE TABLE IF NOT EXISTS public.clas_lojas (
  id uuid primary key default gen_random_uuid(),
  cla_id uuid not null references public.clas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade unique,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_clas_lojas_cla_id ON public.clas_lojas(cla_id);

CREATE TABLE IF NOT EXISTS public.clas_entregadores (
  id uuid primary key default gen_random_uuid(),
  cla_id uuid not null references public.clas(id) on delete cascade,
  entregador_id uuid not null references public.entregadores(id) on delete cascade unique,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_clas_entregadores_cla_id ON public.clas_entregadores(cla_id);

-- Remove a sobrecarga de 3 parâmetros (lat, lng, raio_km) — é a versão
-- realmente chamada hoje pelo despacho-engine, e SEM exclusividade de clã
-- nenhuma. Mantê-la viva ao lado da versão de 4 parâmetros seria uma
-- armadilha: qualquer chamada futura que esqueça de passar p_loja_id cairia
-- silenciosamente nesta versão antiga, sem filtro de clã nenhum. Depois
-- desta migration, o despacho-engine (index.ts) passa a chamar só a de 4
-- parâmetros, sempre.
DROP FUNCTION IF EXISTS public.entregadores_no_raio(double precision, double precision, double precision);

-- A sobrecarga de 4 parâmetros já existia no banco (criada direto, fora de
-- qualquer migration deste repositório) com um modelo de BLOQUEIO via
-- entregadores_bloqueados_loja — nunca chamada por nenhum código (nem
-- despacho-engine, nem app.js), tabela com 0 linhas. CREATE OR REPLACE troca
-- o corpo pelo modelo de EXCLUSIVIDADE de clã (lista branca, o inverso do
-- protótipo abandonado). A tabela entregadores_bloqueados_loja fica intocada
-- (fora de escopo, sem referência nenhuma no código) — não é usada aqui.
--
-- BUG PRÉ-EXISTENTE MUITO MAIS GRAVE, ENCONTRADO E CORRIGIDO NO CAMINHO (não
-- introduzido por esta migration — reproduzido de novo recriando a fórmula
-- original da sobrecarga de 3 parâmetros, byte a byte, antes de ela ser
-- dropada acima, e também bate com o comportamento real observado hoje em
-- produção): os parâmetros da function sempre se chamaram `lat`/`lng` — o
-- MESMO nome das colunas `entregadores.lat`/`entregadores.lng`. Mesmo toda
-- referência à coluna sendo sempre qualificada (`e.lat`, nunca `lat` bare),
-- dentro de uma function LANGUAGE sql isso faz o Postgres resolver errado:
-- `radians(lat)` (que devia ser o parâmetro, o ponto de referência) acaba
-- colidindo com a coluna, e a fórmula sempre computa a distância de cada
-- entregador PRA ELE MESMO (arg do acos = 1, distância = 0), não a distância
-- real até o ponto de referência. Confirmado isolando com funções de teste:
-- os parâmetros sozinhos (`SELECT lat, lng`) vêm certos, e.lat/e.lng vêm
-- certos, mas a expressão combinada dentro da function dá exatamente 1
-- pra QUALQUER entregador, mesmo um a 500km de distância real.
--
-- Efeito em produção: como `distancia_km` sempre sai ~0, o filtro
-- `<= raio_km` nunca exclui ninguém — toda "onda" de raio crescente (4km,
-- 8km, 16km, 32km) na prática despachava pra QUALQUER entregador disponível
-- em qualquer distância, sem filtro de raio nenhum, silenciosamente, desde
-- que essa function existe. Corrigido renomeando os parâmetros pra
-- `p_lat`/`p_lng`/`p_raio_km` (sem colisão com nenhuma coluna) — o
-- despacho-engine (index.ts) precisa chamar a RPC com essas novas chaves.
--
-- Bug separado, também pré-existente e também corrigido aqui: com os nomes
-- corrigidos, o argumento do acos() pode passar de 1.0 por erro de
-- arredondamento de ponto flutuante em pares de coordenadas legítimos
-- (confirmado com dado real: entregador "samuel victor de assis" contra uma
-- loja em Campinas, ~205km de distância real, nada exótico) — acos() do
-- Postgres não tolera argumento fora de [-1,1] e derruba a query inteira
-- (como despacho-engine só faz `const {data,error}=await rpc(...)` e segue,
-- isso nunca crasha nada — só faz aquele pedido não ser ofertado a ninguém
-- naquele tick, em silêncio). Fix padrão: LEAST(1, GREATEST(-1, ...)) trava
-- o argumento em [-1,1] antes do acos.
-- CREATE OR REPLACE não permite renomear parâmetro mantendo os mesmos tipos
-- (é exatamente o caso aqui: lat/lng/raio_km -> p_lat/p_lng/p_raio_km) —
-- precisa dropar antes. Seguro rodar de novo (IF EXISTS).
DROP FUNCTION IF EXISTS public.entregadores_no_raio(double precision, double precision, double precision, uuid);

CREATE OR REPLACE FUNCTION public.entregadores_no_raio(
  p_lat double precision, p_lng double precision, p_raio_km double precision,
  p_loja_id uuid DEFAULT NULL::uuid
)
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
