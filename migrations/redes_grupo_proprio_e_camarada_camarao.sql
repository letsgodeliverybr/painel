-- Complementa recategorizar_lojas_pulverizados_literal.sql. As redes de
-- verdade saíram da lista "marcas" do grupo Pulverizados (_GRUPOS_CATEGORIA_DEF,
-- app.js) e viraram grupo próprio no gráfico "Lojas por Categoria" — nenhuma
-- mudança de categoria nas lojas em si foi necessária pra isso (elas já
-- tinham a marca como categoria, ex: "Villa Sucrêa"), só a definição de
-- grupo mudou.
--
-- Única mudança de DADO real: "CAMARADA CAMARÃO - RP" tinha
-- categoria='Restaurantes' (genérica, dentro de Pulverizados) — atualizada
-- pra categoria='Camarada Camarão' (a marca em si, virou grupo próprio),
-- mesmo tendo só 1 loja hoje — exceção confirmada com o usuário (rede
-- nacional real com expansão prevista, grupo criado antecipadamente).
UPDATE public.lojas SET categoria='Camarada Camarão', updated_at=NOW()
WHERE id='dd955678-fdfd-4201-bb2b-2e5e6ac6cfa0' AND nome='CAMARADA CAMARÃO - RP';
