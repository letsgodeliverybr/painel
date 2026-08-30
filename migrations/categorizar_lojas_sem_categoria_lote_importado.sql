-- Categoriza as 207 lojas ativas que estavam "Sem categoria" no dashboard
-- (204 do lote de importação em massa + 3 pré-existentes). Não mexe em
-- nenhuma loja que já tinha categoria definida.
--
-- Regra: lojas de REDE (2+ unidades com o mesmo nome-base, removendo o
-- sufixo " - RP" e o texto depois do primeiro " - " restante — ex:
-- "PADARIA VILLA SUCRÊA - DIEDERICHSEN - RP" -> "PADARIA VILLA SUCRÊA" ->
-- limpo do prefixo genérico "PADARIA" -> "VILLA SUCRÊA") viram categoria =
-- nome da rede. O resto vira "Pulverizados" (loja independente).
--
-- 7 redes detectadas (21 lojas), 7 alinhamentos (loja nova que é filial de
-- marca já categorizada em outro lugar — ex: "DESEJO & SABOR - BOTÂNICO -
-- RP" alinhada à categoria "Confeitaria" que "DESEJO & SABOR - RP" já
-- tinha) e 179 "Pulverizados". Total 207 — bate com o valor que aparecia
-- no dashboard antes desse fix.
--
-- Aplicado via REST (não incluído aqui como UPDATE em lote porque cada
-- loja recebe um valor de categoria DIFERENTE) — este arquivo documenta a
-- mudança de dados pra fins de histórico/auditoria, a aplicação real foi
-- feita loja por loja via script.
--
-- IMPORTANTE: os 7 nomes de rede novos (Villa Sucrêa, More Cookies, The
-- Butters, La Francese, Let's Cookies, A Predileta Doceria, Congelô
-- Refeições Congeladas) e o valor "Pulverizados" (que antes só existia
-- como nome de GRUPO, nunca como categoria individual de verdade) foram
-- registrados em _GRUPOS_CATEGORIA_DEF (app.js) — sem isso, mesmo com
-- `categoria` preenchida, o dashboard "Lojas por Categoria" continuaria
-- agrupando tudo em "Sem categoria" (é essa lista que traduz
-- categoria -> grupo pro gráfico).

-- Redes (21 lojas):
UPDATE public.lojas SET categoria='Villa Sucrêa', updated_at=NOW() WHERE nome LIKE 'PADARIA VILLA SUCRÊA -%';
UPDATE public.lojas SET categoria='More Cookies', updated_at=NOW() WHERE nome LIKE 'MORE COOKIES -%';
UPDATE public.lojas SET categoria='The Butters', updated_at=NOW() WHERE nome LIKE 'THE BUTTERS -%';
UPDATE public.lojas SET categoria='La Francese', updated_at=NOW() WHERE nome LIKE 'LA FRANCESE -%';
UPDATE public.lojas SET categoria='Let''s Cookies', updated_at=NOW() WHERE nome LIKE 'LET''S COOKIES -%';
UPDATE public.lojas SET categoria='A Predileta Doceria', updated_at=NOW() WHERE nome LIKE 'A PREDILETA DOCERIA -%';
UPDATE public.lojas SET categoria='Congelô Refeições Congeladas', updated_at=NOW() WHERE nome LIKE 'CONGELÔ REFEIÇÕES CONGELADAS -%';

-- Alinhamentos (7 lojas — filial nova de marca já categorizada em outro lugar):
UPDATE public.lojas SET categoria='Confeitaria', updated_at=NOW() WHERE nome='BISKOITARIA - COOKIES, MACARONS E BROWNIES - RP';
UPDATE public.lojas SET categoria='Empório', updated_at=NOW() WHERE nome='EMPÓRIO SANTA ISABEL - RP';
UPDATE public.lojas SET categoria='Confeitaria', updated_at=NOW() WHERE nome='DESEJO & SABOR - BOTÂNICO - RP';
UPDATE public.lojas SET categoria='Comida Fit', updated_at=NOW() WHERE nome='VIDA LEVE - NATURAIS, SUPLEMENTOS E CONGELADOS - RP';
UPDATE public.lojas SET categoria='Pizzaria', updated_at=NOW() WHERE nome='VIA LUCE PIZZARIA - RP';
UPDATE public.lojas SET categoria='Padaria', updated_at=NOW() WHERE nome='GRANO A MANO PANETTERIA - RP';
UPDATE public.lojas SET categoria='Padaria', updated_at=NOW() WHERE nome='PADARIA BELLA CITTÀ - BOTÂNICO - RP';

-- Resto (179 lojas): Pulverizados — qualquer loja ativa ainda sem
-- categoria depois dos UPDATEs acima.
UPDATE public.lojas SET categoria='Pulverizados', updated_at=NOW()
WHERE ativo=true AND (categoria IS NULL OR categoria='');
