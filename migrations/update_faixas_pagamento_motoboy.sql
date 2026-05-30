-- Atualiza faixas de pagamento do motoboy na tabela tabelas_preco_faixas
-- Tabela pai: tabelas_preco WHERE tipo = 'pagamento' AND ativa = true

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 7.50,  valor_com_retorno = 10.50
WHERE km_ate = 2    AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 7.50,  valor_com_retorno = 10.50
WHERE km_ate = 3    AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 9.10,  valor_com_retorno = 12.74
WHERE km_ate = 4    AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 9.10,  valor_com_retorno = 12.74
WHERE km_ate = 4.5  AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 9.10,  valor_com_retorno = 12.74
WHERE km_ate = 5    AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 10.22, valor_com_retorno = 14.31
WHERE km_ate = 6    AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 10.75, valor_com_retorno = 15.05
WHERE km_ate = 7    AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 11.85, valor_com_retorno = 16.59
WHERE km_ate = 9    AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 15.48, valor_com_retorno = 21.67
WHERE km_ate = 12   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 19.46, valor_com_retorno = 27.24
WHERE km_ate = 15   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 26.70, valor_com_retorno = 37.38
WHERE km_ate = 21   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 33.96, valor_com_retorno = 47.54
WHERE km_ate = 24   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 39.26, valor_com_retorno = 54.96
WHERE km_ate = 28   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 57.00, valor_com_retorno = 79.80
WHERE km_ate = 32   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'pagamento' AND ativa = true LIMIT 1);
