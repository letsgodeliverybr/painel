-- Remove 9 lojas duplicadas do lote de importação em massa (documento
-- placeholder '00000000000000', ver uppercase_sufixo_rp_lojas_importadas.sql
-- e categorizar_lojas_sem_categoria_lote_importado.sql pro mesmo lote).
--
-- Achado: comparando as 204 lojas importadas contra as pré-existentes por
-- similaridade de nome/endereço (Levenshtein), 8 delas já existiam no
-- sistema com cadastro completo (e-mail/login real, possível histórico de
-- pedidos) — ex: "FAMILIARE EMPÓRIO GOURMET - RP" (nova, dados pendentes)
-- duplicando "FAMILIARE GOURMET - RP" (antiga, familiare@letsgo.com.br),
-- mesmo endereço (Av. Nove de Julho, 288). Critério de resolução: mantém
-- a loja ANTIGA, remove a NOVA (só tinha dado placeholder mesmo).
--
-- 1 caso especial: "SORVERTES FINOS VANESA - RP" (nova, nº 1122) e
-- "SORVETES FINOS VANESA - RP" (antiga, sorvetesfinos@letsgo.com.br, nº
-- 1565 no cadastro) — nome 95% igual, endereço diferente. Confirmado com o
-- usuário: é a MESMA loja que mudou de endereço. Mantém a antiga (login
-- preservado), atualiza endereço/lat/lng dela pro endereço novo (já
-- re-geocodificado), remove a duplicata nova.
--
-- Nenhuma das 9 lojas novas tinha pedido associado (qtd_pedidos=0,
-- conferido antes de apagar). 7 delas já tinham login criado (script de
-- geração de login das 204) — limpeza incluiu clientes_app, auth.users e
-- usuarios_painel antes de apagar a loja, pra não deixar conta órfã.
--
-- Aplicado via Management API (não dá pra rodar de novo tal como está —
-- os IDs abaixo já não existem mais; arquivo documenta a mudança de dados
-- pra fins de histórico/auditoria).

-- Limpeza de conta (7 das 9 tinham login já criado):
DELETE FROM public.clientes_app WHERE id IN (
  '25b42312-e9a9-4e70-8053-eb5816ec1dd4', -- Bellissimo Gelato Artesanal
  'dc7b3a76-609b-4ff8-8924-5b87c8e7c7b7', -- Desejo & Sabor - Botânico
  'b711d582-597f-40cd-a696-31a32e0288f0', -- Familiare Empório Gourmet
  '262a5228-499d-4682-a5a6-fba4f104b92a', -- Panificadora Braghetto - Leão
  'ccc0ab7b-1e93-4b8a-99e0-955b0f359ea4', -- Sorvertes Finos Vanesa
  'cad4cc55-2899-45da-aa0f-15106734f04a', -- Via Luce Pizzaria
  '52d60f37-63f9-4d99-808a-9a63e3c7edb3'  -- Vida Leve - Naturais...
);

DELETE FROM auth.users WHERE id IN (
  '25b42312-e9a9-4e70-8053-eb5816ec1dd4',
  'dc7b3a76-609b-4ff8-8924-5b87c8e7c7b7',
  'b711d582-597f-40cd-a696-31a32e0288f0',
  '262a5228-499d-4682-a5a6-fba4f104b92a',
  'ccc0ab7b-1e93-4b8a-99e0-955b0f359ea4',
  'cad4cc55-2899-45da-aa0f-15106734f04a',
  '52d60f37-63f9-4d99-808a-9a63e3c7edb3'
);

-- Remoção das 9 lojas duplicadas (todas do lote, documento placeholder):
DELETE FROM public.usuarios_painel WHERE loja_id IN (
  '9a208d83-b5fa-4bfb-901c-a53f12c0d0aa', -- Bellissimo Gelato Artesanal
  '77adda92-50a3-476d-9a6a-dbcee99661c7', -- Desejo & Sabor - Botânico
  'e98104b0-f982-4f0b-b76e-301d69164230', -- Empório Santa Isabel (nova)
  'd88b065c-ece9-4c37-914c-4555e4b6b4d3', -- Familiare Empório Gourmet
  '306d1d42-eb4f-4f5f-8451-ecb9cd36dec1', -- Panificadora Braghetto - Leão
  '1e15e1de-4a38-438c-a089-cc658b20352f', -- Sorvertes Finos Vanesa
  '035a389c-e94d-40a4-9a8c-2963a7f7768d', -- Terraço Pizza Bar (nova)
  '95aab11f-c6ea-433d-994b-7e7b2083d767', -- Via Luce Pizzaria
  '29a0d3bf-03b1-4687-96b8-ab79d8c216c9'  -- Vida Leve - Naturais...
);

DELETE FROM public.lojas WHERE id IN (
  '9a208d83-b5fa-4bfb-901c-a53f12c0d0aa',
  '77adda92-50a3-476d-9a6a-dbcee99661c7',
  'e98104b0-f982-4f0b-b76e-301d69164230',
  'd88b065c-ece9-4c37-914c-4555e4b6b4d3',
  '306d1d42-eb4f-4f5f-8451-ecb9cd36dec1',
  '1e15e1de-4a38-438c-a089-cc658b20352f',
  '035a389c-e94d-40a4-9a8c-2963a7f7768d',
  '95aab11f-c6ea-433d-994b-7e7b2083d767',
  '29a0d3bf-03b1-4687-96b8-ab79d8c216c9'
) AND documento='00000000000000';

-- Caso especial: Sorvetes Finos Vanesa mudou de endereço. Mantém a loja
-- antiga (login real sorvetesfinos@letsgo.com.br), atualiza endereço +
-- coordenada pro endereço do lote novo, já re-geocodificado.
UPDATE public.lojas SET
  endereco = 'R. Américo Brasiliense, 1122 - Centro, Ribeirão Preto - SP, 14015-050, Brasil',
  latitude = -21.1807385,
  longitude = -47.8054330,
  updated_at = NOW()
WHERE id = '9a396632-6edb-471f-8811-c8461e6b70f9' AND nome = 'SORVETES FINOS VANESA - RP';
