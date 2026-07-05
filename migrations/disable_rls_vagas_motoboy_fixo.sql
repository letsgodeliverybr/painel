-- Corrige "❌ Erro ao criar vaga." na tela Vagas Disponíveis.
--
-- A tabela public.vagas_motoboy_fixo foi criada com RLS habilitada (sem
-- nenhuma política), diferente do padrão usado nas outras tabelas novas
-- desta sessão (creditos_lojas, contas_pagar, feriados_importantes), que
-- não têm RLS — isolamento por loja é feito no client via _lojaFiltro().
-- Sem política de INSERT, o SELECT (anon) continuava funcionando e
-- retornando vazio, mas todo INSERT era bloqueado silenciosamente pelo
-- Postgres, daí o erro genérico no painel.

ALTER TABLE public.vagas_motoboy_fixo DISABLE ROW LEVEL SECURITY;
