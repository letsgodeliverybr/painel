-- lojas não tinha nenhuma coluna de CPF/CNPJ (confirmado ao vivo: schema
-- real não tem cpf, cnpj, nem documento) — precisa pro autocadastro
-- público de loja (modal-cadastro-loja / enviarCadastroLoja em app.js)
-- exigir esse dado, hoje ausente.
--
-- Texto puro, só dígitos (sem máscara/formatação no banco — a máscara é
-- só visual, no formulário) — mesmo padrão já usado em telefone/celular
-- desta tabela. Aceita CPF (11 dígitos) ou CNPJ (14 dígitos), sem
-- constraint de tamanho fixo no banco (a validação de formato + dígito
-- verificador acontece no app, antes de enviar).
--
-- NULLABLE de propósito: 95 lojas já cadastradas não têm esse dado, e não
-- há CPF/CNPJ real disponível pra popular retroativamente sem pedir pra
-- cada uma — NOT NULL quebraria elas. Obrigatório só pra cadastro NOVO,
-- validado no app (enviarCadastroLoja), não como constraint de banco.
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS documento text;

COMMENT ON COLUMN public.lojas.documento IS 'CPF (11 dígitos) ou CNPJ (14 dígitos) do responsável/empresa, só dígitos, sem máscara. Nullable — obrigatório apenas para cadastros novos via app, não enforced por constraint (95 lojas pré-existentes sem esse dado).';
