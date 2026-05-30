-- Atualiza faixas de precificação em tabelas_preco_faixas
-- Tabelas pai em tabelas_preco identificadas por tipo

-- ═══════════════════════════════════
-- TABELA MOTOBOY (tipo = 'motoboy')
-- ═══════════════════════════════════
UPDATE tabelas_preco_faixas SET valor_sem_retorno = 7.50,  valor_com_retorno = 10.50
WHERE km_ate = 1.5  AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'motoboy' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 7.50,  valor_com_retorno = 10.50
WHERE km_ate = 3    AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'motoboy' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 9.10,  valor_com_retorno = 12.74
WHERE km_ate = 4.5  AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'motoboy' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 10.22, valor_com_retorno = 14.31
WHERE km_ate = 6    AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'motoboy' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 10.75, valor_com_retorno = 15.05
WHERE km_ate = 7.5  AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'motoboy' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 11.85, valor_com_retorno = 16.59
WHERE km_ate = 9    AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'motoboy' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 15.48, valor_com_retorno = 21.67
WHERE km_ate = 12   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'motoboy' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 19.46, valor_com_retorno = 27.24
WHERE km_ate = 15   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'motoboy' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 26.70, valor_com_retorno = 37.38
WHERE km_ate = 18   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'motoboy' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 31.32, valor_com_retorno = 43.85
WHERE km_ate = 21   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'motoboy' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 33.96, valor_com_retorno = 47.54
WHERE km_ate = 24   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'motoboy' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 39.26, valor_com_retorno = 54.96
WHERE km_ate = 28   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'motoboy' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 57.00, valor_com_retorno = 79.80
WHERE km_ate = 32   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'motoboy' AND ativa = true LIMIT 1);

-- ═══════════════════════════════════
-- TABELA LOJA (tipo = 'cliente')
-- ═══════════════════════════════════
UPDATE tabelas_preco_faixas SET valor_sem_retorno = 10.45, valor_com_retorno = 14.63
WHERE km_ate = 1.5  AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'cliente' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 11.57, valor_com_retorno = 16.20
WHERE km_ate = 3    AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'cliente' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 12.10, valor_com_retorno = 16.94
WHERE km_ate = 4.5  AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'cliente' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 13.22, valor_com_retorno = 18.51
WHERE km_ate = 6    AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'cliente' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 13.75, valor_com_retorno = 19.25
WHERE km_ate = 7.5  AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'cliente' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 14.85, valor_com_retorno = 20.79
WHERE km_ate = 9    AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'cliente' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 18.48, valor_com_retorno = 25.87
WHERE km_ate = 12   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'cliente' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 22.46, valor_com_retorno = 31.44
WHERE km_ate = 15   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'cliente' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 29.70, valor_com_retorno = 41.58
WHERE km_ate = 18   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'cliente' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 34.32, valor_com_retorno = 48.05
WHERE km_ate = 21   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'cliente' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 36.96, valor_com_retorno = 51.74
WHERE km_ate = 24   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'cliente' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 42.26, valor_com_retorno = 59.16
WHERE km_ate = 28   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'cliente' AND ativa = true LIMIT 1);

UPDATE tabelas_preco_faixas SET valor_sem_retorno = 60.00, valor_com_retorno = 84.00
WHERE km_ate = 32   AND tabela_id = (SELECT id FROM tabelas_preco WHERE tipo = 'cliente' AND ativa = true LIMIT 1);
