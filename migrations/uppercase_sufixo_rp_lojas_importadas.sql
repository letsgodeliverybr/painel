-- Ajusta o nome das 204 lojas do lote de importação em massa (feature
-- "Importar Rede de Lojas", commit a7ecbec) pro mesmo padrão das lojas já
-- existentes: CAIXA ALTA + " - RP" no final (Ribeirão Preto).
--
-- Identificação do lote: documento='00000000000000' (placeholder — ver
-- validar_documento_telefone_loja_com_placeholder.sql) é único desse
-- import, nenhuma loja anterior tem esse valor exato — confirmado batendo
-- 204 lojas, o mesmo total do log_acoes 'importar_rede_lojas'.
--
-- Não duplica o sufixo se o nome já mencionar "RP" como palavra isolada
-- (com ou sem traço) — ex: "Açaí Mania RP" fica só em caixa alta, sem
-- virar "AÇAÍ MANIA RP - RP". \m/\M = início/fim de palavra (sintaxe de
-- regex do Postgres), evita falso positivo em nomes como "Ribeirão Preto"
-- (tem "rp" como substring, não como palavra).
UPDATE public.lojas
SET
  nome = UPPER(nome) || CASE WHEN UPPER(nome) ~ '\mRP\M' THEN '' ELSE ' - RP' END,
  updated_at = NOW()
WHERE documento = '00000000000000';
