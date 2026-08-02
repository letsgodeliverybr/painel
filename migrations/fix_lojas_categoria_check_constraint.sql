-- Corrige lojas_categoria_check pra bater exatamente com CATEGORIAS_LOJA
-- em app.js — essa constraint NÃO foi criada por nenhuma migration deste
-- repositório (add_categoria_lojas.sql foi escrita de propósito sem CHECK
-- constraint, mesmo padrão de tipo_cliente/tipo_cobranca). Alguém deve ter
-- adicionado direto pelo Supabase Studio, com uma lista que ficou
-- desatualizada assim que "Suplementos" foi acrescentado só no front-end
-- — erro 400 real em produção salvando a loja TOPFIT - RP.
--
-- Lista abaixo gerada direto a partir de CATEGORIAS_LOJA (app.js) — se
-- essa constante mudar de novo no futuro, esta migration precisa ser
-- atualizada junto (não tem como o Postgres validar contra o JS
-- automaticamente). Permite NULL — lojas ainda não classificadas
-- continuam válidas.
--
-- Antes da constraint, zera um valor legado encontrado em produção: as
-- 62 lojas (100% delas) estavam com categoria='restaurante' (minúsculo,
-- singular — não é nenhum valor do dropdown). Não é dado real classificado
-- por ninguém, é claramente um placeholder/default de antes do dropdown
-- existir — inclusive uma farmácia (Ultrafarma São Bernardo) estava
-- marcada assim. Voltar pra NULL (em vez de forçar tudo pra
-- "Restaurantes") mantém o mesmo princípio já usado em
-- add_motoboys_novos_por_mes_rpc.sql: não inventa dado, mostra
-- "não classificado" honestamente até alguém classificar de verdade pela
-- interface.
UPDATE public.lojas SET categoria = NULL WHERE categoria = 'restaurante';

-- ⚠️ INVESTIGADO EM PRODUÇÃO — causa raiz do valor 'restaurante' NÃO
-- resolvida por completo, só mitigada. O que se sabe:
--   - lojas.categoria tinha DEFAULT 'restaurante'::text configurado direto
--     no banco (nunca criado por nenhuma migration deste repositório).
--   - Algo reescrevia categoria='restaurante' em TODAS as 62 lojas
--     repetidamente, poucos segundos/minutos depois de um UPDATE zerando
--     o valor — isolado experimentalmente desativando cada cron job um
--     por um (`SELECT cron.alter_job(...active:=false)`): o reset parava
--     de acontecer só com despacho-engine-cron desativado (roda a cada
--     minuto, `SELECT net.http_post(...despacho-engine...)`).
--   - O código de supabase/functions/despacho-engine/index.ts NESTE
--     repositório só faz SELECT em lojas (nenhum INSERT/UPDATE/upsert) —
--     ou seja, o código REALMENTE DEPLOYADO no Supabase pra essa function
--     diverge do que está versionado aqui. Ninguém confirmou ainda qual é
--     essa diferença (precisa `supabase functions download despacho-engine`
--     ou olhar direto no Dashboard).
--   - despacho-engine-cron é crítico pra operação (despacha pedidos
--     prontos pros motoboys) — não pode ficar desativado como fix
--     permanente, só foi desligado temporariamente durante o diagnóstico
--     e já foi reativado.
-- Mitigação aplicada agora: tira o DEFAULT. Se o processo desconhecido
-- que reescreve a linha omite a coluna categoria (hipótese mais provável
-- — um INSERT/upsert que não a este repositório e não especifica
-- categoria), sem DEFAULT o resultado passa a ser NULL (honesto, "não
-- classificado") em vez de 'restaurante' (dado errado, mas com cara de
-- classificado). Não resolve a causa raiz — só impede que ela grave lixo.
ALTER TABLE public.lojas ALTER COLUMN categoria DROP DEFAULT;

ALTER TABLE public.lojas DROP CONSTRAINT IF EXISTS lojas_categoria_check;

ALTER TABLE public.lojas ADD CONSTRAINT lojas_categoria_check
  CHECK (categoria IS NULL OR categoria IN (
    'Restaurantes', 'Hamburgueria', 'Japonesa', 'Pizzaria', 'Confeitaria',
    'Sorveteria', 'Açaí', 'Casa de Carnes', 'Padaria', 'Comida Fit',
    'Suplementos', 'Marmitaria', 'Mercado', 'Conveniência', 'Adega',
    'Pet Shop', 'Farmácia', 'Auto Peças', 'Tabacarias', 'App Let''s Go'
  ));
