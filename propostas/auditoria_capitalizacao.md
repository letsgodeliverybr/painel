# Auditoria de capitalização — painel (loja, admin, suporte)

Gerado em 30/09/2026 a partir do app.js atual e do hostinger/index.html. **Só leitura — nada foi alterado.**

**317 textos fora da regra** (281 no app.js, 36 no HTML do Hostinger), em 49 telas.

## Regras usadas

- Títulos, rótulos, botões, abas, menus, cabeçalhos de tabela e opções: Title Case, com minúsculas no meio para: de, do, da, dos, das, para, e, em, no, na, com, o, a.
- **A confirmar:** também deixei minúsculas **ao, aos, à, às, os, as, por, ou, nos, nas, pelo, pela, pro, pra, um, uma** (sem isso fica "CPF Ou CNPJ", "Pedidos Finalizados Por Categoria"). A coluna "só com a sua lista" mostra como ficaria sem esse acréscimo.
- Frases (avisos de sucesso/erro, "Carregando...", "Nenhum ... encontrado", instruções): só a 1ª letra maiúscula.
- Não entram: siglas (CPF, CNPJ, CEP, PDV, C.A.C., KM...), nomes próprios (Let's Go, iFood, WhatsApp, Pix, Google...), valores, e-mails, URLs, mensagens de WhatsApp, dados do banco (categorias, nomes de loja), textos entre parênteses (salvo quando o rótulo inteiro está em CAIXA ALTA) e trechos no meio de frases.
- "PIX" vira "Pix" (grafia oficial do Banco Central).

## Atenção antes de aprovar

- **57 rótulos em CAIXA ALTA** (ex.: "DATA INICIO", "LUCRO NO PERÍODO"): em vários cards e filtros a caixa alta é visual; onde o CSS já aplica text-transform uppercase, a aparência não muda. Posso deixar esses de fora.
- **10 itens marcados "não alterar"**: 8 são textos do carrossel que você aprovou (ficam como estão) e 2 são nomes de rede/categoria (IMC, DPSP).
- **32 frases**: a proposta só abaixa palavras maiúsculas no meio da frase — conferir nomes próprios.
- **4 itens estão em código sem uso** (menu antigo da loja, boas-vindas removida) — não aparecem na tela; sugiro ignorar.
- **36 itens do HTML do Hostinger** (login, modais fixos) só mudam em produção se o index.html for enviado de novo ao Hostinger.

## Resumo por tela

| Tela | Itens |
|---|---|
| HTML do Hostinger (login e modais fixos) | 36 |
| Pedidos | 26 |
| Gestor de Pedidos / Mapa | 15 |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | 13 |
| Créditos | 12 |
| C.A.C. | 10 |
| Contas a Pagar | 10 |
| Saque Rápido | 10 |
| Clientes (loja) | 9 |
| Editar Entregador | 9 |
| Gerar Pagamentos | 9 |
| Cadastro de loja em etapas | 8 |
| Editar Loja | 8 |
| Início da loja (carrossel) | 8 |
| Novo Pedido | 8 |
| Visão Executiva | 8 |
| Configuração → iFood | 7 |
| Fatura (detalhe) | 7 |
| Página de rastreio (cliente final) | 7 |
| Gerar Cobranças | 6 |
| Início da loja | 6 |
| Pedidos (editar pedido) | 6 |
| Tabelas de Preço | 6 |
| Cadastros → Importar lojas | 5 |
| Configuração → Integrações | 5 |
| Preço Dinâmico | 5 |
| Boas-vindas da loja (removida) | 4 |
| Configuração → Cliente | 4 |
| Entrega Dedicada | 4 |
| Menu lateral | 4 |
| Recarga de saldo (modal) | 4 |
| Aprovar Cobranças | 3 |
| Aprovar Saques | 3 |
| Cancelamento iFood | 3 |
| Configuração → Operação | 3 |
| Notificações (disparo) | 3 |
| Novo Entregador | 3 |
| WhatsApp Financeiro | 3 |
| Cadastros → Entregadores | 2 |
| Cadastros → Estabelecimentos | 2 |
| Desempenho | 2 |
| Lojas | 2 |
| Pedidos (comanda) | 2 |
| Pedidos (detalhes) | 2 |
| Cardápio digital | 1 |
| Configuração | 1 |
| Integrações (em breve) | 1 |
| Pedidos (código iFood) | 1 |
| Relatórios | 1 |

## Tabela completa (por tela)

### HTML do Hostinger (login e modais fixos)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| hostinger/index.html:301 | texto-html | Acessar o sistema | Acessar o Sistema |  |  |
| hostinger/index.html:303 | texto-html | Email de acesso | Email de Acesso |  |  |
| hostinger/index.html:307 | texto-html | Esqueci minha senha | Esqueci Minha Senha |  |  |
| hostinger/index.html:325 | texto-html | 🏪 Cadastrar minha loja | 🏪 Cadastrar Minha Loja |  |  |
| hostinger/index.html:331 | placeholder | Rua, número, bairro | Rua, Número, Bairro |  |  |
| hostinger/index.html:337 | placeholder | Nome completo | Nome Completo |  |  |
| hostinger/index.html:342 | placeholder | Mínimo 6 caracteres | Mínimo 6 Caracteres |  |  |
| hostinger/index.html:348 | texto-html | Enviar cadastro | Enviar Cadastro |  |  |
| hostinger/index.html:389 | texto-html | Essa integração está em preparação. Em breve, lojas parceiras do Cardápio Web poderão conectar sua conta aqui para que os pedidos sejam despachados automaticamente pela Let's Go Delivery. | Essa integração está em preparação. Em breve, lojas parceiras do cardápio web poderão conectar sua conta aqui para que os pedidos sejam despachados automaticamente pela Let's Go Delivery. |  | frase |
| hostinger/index.html:417 | title-attr | Saldo da carteira | Saldo da Carteira |  |  |
| hostinger/index.html:420 | texto-html | WALLET | Wallet |  | caixa alta |
| hostinger/index.html:428 | title-attr | Horário de Brasília — conferência visual | Horário de brasília — conferência visual |  | frase |
| hostinger/index.html:446 | placeholder | Nome do cliente | Nome do Cliente |  |  |
| hostinger/index.html:449 | texto-html | Endereço de entrega | Endereço de Entrega |  |  |
| hostinger/index.html:449 | placeholder | Rua, número, bairro | Rua, Número, Bairro |  |  |
| hostinger/index.html:477 | texto-html | Nome da loja | Nome da Loja |  |  |
| hostinger/index.html:478 | placeholder | Razão social | Razão Social |  |  |
| hostinger/index.html:503 | texto-html | IMC | Imc |  | caixa alta, **não alterar: dado (categoria/banco)** |
| hostinger/index.html:511 | texto-html | Bacio di Latte | Bacio Di Latte |  |  |
| hostinger/index.html:521 | texto-html | DPSP | Dpsp |  | caixa alta, **não alterar: dado (categoria/banco)** |
| hostinger/index.html:547 | placeholder | Inscrição estadual | Inscrição Estadual |  |  |
| hostinger/index.html:548 | placeholder | Inscrição municipal | Inscrição Municipal |  |  |
| hostinger/index.html:550 | placeholder | Rua, número, bairro | Rua, Número, Bairro |  |  |
| hostinger/index.html:557 | placeholder | Tipo de cliente | Tipo de Cliente |  |  |
| hostinger/index.html:558 | placeholder | Nome do responsável | Nome do Responsável |  |  |
| hostinger/index.html:565 | texto-html | E-mail de acesso | E-mail de Acesso |  |  |
| hostinger/index.html:566 | texto-html | Senha de acesso | Senha de Acesso |  |  |
| hostinger/index.html:566 | placeholder | Senha para login | Senha para Login |  |  |
| hostinger/index.html:570 | texto-html | APP LET'S GO CLIENTE | App Let's Go Cliente |  | caixa alta |
| hostinger/index.html:580 | texto-html | Ativar roterizador para esta loja | Ativar Roterizador para Esta Loja |  |  |
| hostinger/index.html:582 | texto-html | Raio de agrupamento (km) | Raio de Agrupamento (km) |  |  |
| hostinger/index.html:583 | texto-html | Máximo de pedidos por rota | Máximo de Pedidos por Rota | Máximo de Pedidos Por Rota |  |
| hostinger/index.html:604 | placeholder | Nome completo | Nome Completo |  |  |
| hostinger/index.html:609 | texto-html | 🔐 ADM | 🔐 Adm |  | caixa alta |
| hostinger/index.html:615 | placeholder | Senha de acesso | Senha de Acesso |  |  |
| hostinger/index.html:618 | texto-html | Loja vinculada | Loja Vinculada |  |  |

### Pedidos

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:2870 | notif | 🔔 Pedido Pronto! | 🔔 Pedido pronto! |  | frase |
| app.js:4411 | texto-html | ✓ Todos os pedidos carregados | ✓ Todos os Pedidos Carregados | ✓ Todos Os Pedidos Carregados |  |
| app.js:4701 | label: | Chegou no local | Chegou no Local |  |  |
| app.js:4702 | label: | Em rota | Em Rota |  |  |
| app.js:4703 | label: | Chegou no destino | Chegou no Destino |  |  |
| app.js:4760 | texto-html | CÓDIGO | Código |  | caixa alta |
| app.js:4777 | texto-html | 🏪 Retirada na loja | 🏪 Retirada na Loja |  |  |
| app.js:4821 | title-attr | Pedido da integração iFood | Pedido da Integração iFood |  |  |
| app.js:4833 | title-attr | Solicitar entregador sob demanda | Solicitar Entregador Sob Demanda |  |  |
| app.js:4837 | title-attr | Alocar entregador | Alocar Entregador |  |  |
| app.js:7400 | texto-html | TODOS OS PEDIDOS | Todos os Pedidos | Todos Os Pedidos | caixa alta |
| app.js:7401 | texto-html | FINALIZADOS | Finalizados |  | caixa alta |
| app.js:7402 | texto-html | CANCELADOS | Cancelados |  | caixa alta |
| app.js:7403 | texto-html | TOTAL KM | Total KM |  | caixa alta |
| app.js:7406 | texto-html | FATURAMENTO | Faturamento |  | caixa alta |
| app.js:7407 | texto-html | DESPESAS | Despesas |  | caixa alta |
| app.js:7408 | texto-html | CONTAS A PAGAR | Contas a Pagar |  | caixa alta |
| app.js:7409 | texto-html | LUCRO LÍQUIDO | Lucro Líquido |  | caixa alta |
| app.js:7410 | texto-html | FATURAMENTO MÉDIO/ENTREGA | Faturamento Médio/Entrega |  | caixa alta |
| app.js:7411 | texto-html | CUSTO MÉDIO/ENTREGA | Custo Médio/Entrega |  | caixa alta |
| app.js:7412 | texto-html | LUCRO MÉDIO/ENTREGA | Lucro Médio/Entrega |  | caixa alta |
| app.js:7413 | texto-html | VALOR MERCADORIA | Valor Mercadoria |  | caixa alta |
| app.js:7415 | texto-html | ⏱️ SLA de Entrega (Aceito → Chegada no Cliente) | ⏱️ SLA de entrega (Aceito → chegada no cliente) |  | frase |
| app.js:7546 | label: | 0 a 30 min | 0 A 30 min |  |  |
| app.js:7547 | label: | 30 a 35 min | 30 A 35 min |  |  |
| app.js:7548 | label: | 35 a 40 min | 35 A 40 min |  |  |

### Gestor de Pedidos / Mapa

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:2278 | notif | 🔔 Pedido Pronto! | 🔔 Pedido pronto! |  | frase |
| app.js:2513 | texto-html | ENTREGA | Entrega |  | caixa alta |
| app.js:4214 | title-attr | Abrir/fechar pedidos | Abrir/Fechar Pedidos |  |  |
| app.js:4216 | title-attr | Mostrar/ocultar Pedidos | Mostrar/Ocultar Pedidos |  |  |
| app.js:4218 | texto-html | Finalizados hoje | Finalizados Hoje |  |  |
| app.js:4220 | texto-html | Cancelados hoje | Cancelados Hoje |  |  |
| app.js:4224 | title-attr | Mostrar todos os motoboys | Mostrar Todos os Motoboys | Mostrar Todos Os Motoboys |  |
| app.js:4225 | title-attr | Escondendo lojas sem pedido | Escondendo Lojas Sem Pedido |  |  |
| app.js:4251 | placeholder | Nº pedido | Nº Pedido |  |  |
| app.js:4253 | placeholder | Nome do cliente | Nome do Cliente |  |  |
| app.js:4369 | title-attr | Com retorno | Com Retorno |  |  |
| app.js:4370 | title-attr | Com gorjeta | Com Gorjeta |  |  |
| app.js:4371 | title-attr | Feriado/Promoção global | Feriado/Promoção Global |  |  |
| app.js:4371 | title-attr | Taxa dinâmica (cidade) | Taxa Dinâmica (cidade) |  |  |
| app.js:13703 | texto-html | Pedido Não Encontrado. | Pedido não encontrado. |  | frase |

### Modais do topo (Novo Pedido, Nova Loja, etc.)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:2358 | texto-html | Plataforma de origem | Plataforma de Origem |  |  |
| app.js:2361 | placeholder | Nome do cliente | Nome do Cliente |  |  |
| app.js:2365 | texto-html | Endereço de entrega | Endereço de Entrega |  |  |
| app.js:2365 | placeholder | Rua, número, bairro | Rua, Número, Bairro |  |  |
| app.js:2368 | placeholder | Apto, bloco, ponto de referência | Apto, Bloco, Ponto de Referência |  |  |
| app.js:2387 | texto-html | 📦 Coleta em outro endereço | 📦 Coleta em Outro Endereço |  |  |
| app.js:2391 | texto-html | Endereço de coleta | Endereço de Coleta |  |  |
| app.js:2391 | placeholder | Rua, número, bairro | Rua, Número, Bairro |  |  |
| app.js:2395 | texto-html | Contato na coleta | Contato na Coleta |  |  |
| app.js:2395 | placeholder | Nome do contato | Nome do Contato |  |  |
| app.js:2396 | texto-html | Telefone da coleta | Telefone da Coleta |  |  |
| app.js:2401 | texto-html | ⏰ Agendar pedido | ⏰ Agendar Pedido |  |  |
| app.js:2405 | texto-html | Data e hora | Data e Hora |  |  |

### Créditos

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:9973 | _scLabel() | NOME | Nome |  | caixa alta |
| app.js:9974 | _scLabel() | DATA INICIO | Data Inicio |  | caixa alta |
| app.js:9975 | _scLabel() | DATA FIM | Data Fim |  | caixa alta |
| app.js:9976 | _scLabel() | TIPO | Tipo |  | caixa alta |
| app.js:9986 | _scLabel() | ENTIDADE | Entidade |  | caixa alta |
| app.js:9987 | texto-html | Ajuste manual (crédito ou débito) | Ajuste Manual (crédito ou débito) |  |  |
| app.js:9987 | _scLabel() | LANÇAMENTO | Lançamento |  | caixa alta |
| app.js:9988 | _scLabel() | DATA | Data |  | caixa alta |
| app.js:9989 | _scLabel() | TIPO | Tipo |  | caixa alta |
| app.js:9990 | _scLabel() | VALOR | Valor |  | caixa alta |
| app.js:9992 | _scLabel() | OBSERVACOES | Observacoes |  | caixa alta |
| app.js:10110 | texto-html | Bônus fora da janela | Bônus Fora da Janela |  |  |

### C.A.C.

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:7305 | texto-html | — (sem meta) | — (Sem meta) |  | frase |
| app.js:7317 | texto-html | Nenhum vendedor cadastrado — cadastre em Cadastros → Vendedores. | Nenhum vendedor cadastrado — cadastre em cadastros → vendedores. |  | frase |
| app.js:7328 | texto-html | Nenhuma loja com vendedor responsável ainda — atribua em Cadastros → Estabelecimentos → Editar Loja. | Nenhuma loja com vendedor responsável ainda — atribua em cadastros → estabelecimentos → editar loja. |  | frase |
| app.js:7332 | texto-html | Lojas novas | Lojas Novas |  |  |
| app.js:7332 | texto-html | Pedidos na janela | Pedidos na Janela |  |  |
| app.js:7332 | texto-html | Bônus acumulado | Bônus Acumulado |  |  |
| app.js:7332 | texto-html | Bônus no mês | Bônus no Mês |  |  |
| app.js:7332 | texto-html | Meta/mês | Meta/Mês |  |  |
| app.js:7333 | texto-html | Lojas novas por vendedor | Lojas Novas por Vendedor | Lojas Novas Por Vendedor |  |
| app.js:7334 | texto-html | Início contagem | Início Contagem |  |  |

### Contas a Pagar

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:10167 | _scLabel() | MÊS/ANO | Mês/Ano |  | caixa alta |
| app.js:10168 | _scLabel() | DESCRIÇÃO | Descrição |  | caixa alta |
| app.js:10169 | _scLabel() | CATEGORIA | Categoria |  | caixa alta |
| app.js:10174 | _scLabel() | VALOR | Valor |  | caixa alta |
| app.js:10175 | _scLabel() | STATUS | Status |  | caixa alta |
| app.js:10176 | _scLabel() | VENCIMENTO | Vencimento |  | caixa alta |
| app.js:10183 | _scLabel() | FILTRAR POR MÊS | Filtrar por Mês | Filtrar Por Mês | caixa alta |
| app.js:10247 | textContent | Editar Conta a Pagar | Editar conta a pagar |  | frase |
| app.js:10248 | textContent | Salvar Edição | Salvar edição |  | frase |
| app.js:10261 | textContent | Cadastrar Conta a Pagar | Cadastrar conta a pagar |  | frase |

### Saque Rápido

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:11236 | texto-html | CAIXA | Caixa |  | caixa alta |
| app.js:11236 | title-attr | Definir caixa | Definir Caixa |  |  |
| app.js:11243 | texto-html | PAGO NO PERÍODO | Pago no Período |  | caixa alta |
| app.js:11244 | texto-html | LUCRO NO PERÍODO | Lucro no Período |  | caixa alta |
| app.js:11247 | texto-html | DATA INÍCIO | Data Início |  | caixa alta |
| app.js:11248 | texto-html | DATA FIM | Data Fim |  | caixa alta |
| app.js:11252 | texto-html | Saques rápidos pendentes de aprovação | Saques Rápidos Pendentes de Aprovação |  |  |
| app.js:11315 | texto-html | Selecionar todos | Selecionar Todos |  |  |
| app.js:11319 | texto-html | Chave PIX | Chave Pix |  |  |
| app.js:11319 | texto-html | Tipo PIX | Tipo Pix |  |  |

### Clientes (loja)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:13261 | texto-html | Ticket médio | Ticket Médio |  |  |
| app.js:13262 | texto-html | Dia com mais pedidos | Dia com Mais Pedidos |  |  |
| app.js:13263 | texto-html | Item mais pedido | Item Mais Pedido |  |  |
| app.js:13269 | texto-html | Clientes novos (30 dias) | Clientes Novos (30 dias) |  |  |
| app.js:13273 | texto-html | Evolução de clientes por semana | Evolução de Clientes por Semana | Evolução de Clientes Por Semana |  |
| app.js:13278 | texto-html | Hábitos de compra | Hábitos de Compra |  |  |
| app.js:13281 | texto-html | Clientes mais frequentes (90 dias) | Clientes Mais Frequentes (90 dias) |  |  |
| app.js:13283 | texto-html | Último pedido | Último Pedido |  |  |
| app.js:13283 | texto-html | Ticket médio | Ticket Médio |  |  |

### Editar Entregador

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:6418 | texto-html | Ver foto | Ver Foto |  |  |
| app.js:6498 | fi() | Nome completo | Nome Completo |  |  |
| app.js:6500 | opção [v,t] | Sem clã | Sem Clã |  |  |
| app.js:6501 | fi() | Data de nascimento | Data de Nascimento |  |  |
| app.js:6513 | fi() | Tipo de pagamento | Tipo de Pagamento |  |  |
| app.js:6514 | fi() | Tipo chave PIX | Tipo Chave Pix |  |  |
| app.js:6514 | fi() | Chave PIX | Chave Pix |  |  |
| app.js:6515 | texto-html | Máquina de cartão | Máquina de Cartão |  |  |
| app.js:6515 | texto-html | Possui máquina de cartão | Possui Máquina de Cartão |  |  |

### Gerar Pagamentos

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:10920 | texto-html | Data início | Data Início |  |  |
| app.js:10925 | texto-html | Data fim | Data Fim |  |  |
| app.js:10985 | texto-html | TOTAL PAGAMENTO AOS MOTOBOYS | Total Pagamento aos Motoboys | Total Pagamento Aos Motoboys | caixa alta |
| app.js:11048 | texto-html | Selecionar todos | Selecionar Todos |  |  |
| app.js:11052 | texto-html | Chave PIX | Chave Pix |  |  |
| app.js:11052 | texto-html | Tipo PIX | Tipo Pix |  |  |
| app.js:11079 | texto-html | Selecionar todos | Selecionar Todos |  |  |
| app.js:11083 | texto-html | Chave PIX | Chave Pix |  |  |
| app.js:11083 | texto-html | Tipo PIX | Tipo Pix |  |  |

### Cadastro de loja em etapas

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:9258 | titulo: | Sobre a sua loja | Sobre a Sua Loja |  |  |
| app.js:9259 | titulo: | Onde fica a sua loja | Onde Fica a Sua Loja |  |  |
| app.js:9261 | titulo: | Documento da loja | Documento da Loja |  |  |
| app.js:9262 | titulo: | Dados de acesso | Dados de Acesso |  |  |
| app.js:9263 | titulo: | Revise seus dados | Revise Seus Dados |  |  |
| app.js:9432 | texto-html | Voltar ao login | Voltar ao Login | Voltar Ao Login |  |
| app.js:9517 | placeholder | Mínimo 6 caracteres | Mínimo 6 Caracteres |  |  |
| app.js:9518 | aria-label | Mostrar senha | Mostrar Senha |  |  |

### Editar Loja

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:8939 | placeholder | Rua, número, bairro | Rua, Número, Bairro |  |  |
| app.js:8942 | opção [v,t] | COLETA FIXA | Coleta Fixa |  | caixa alta |
| app.js:8942 | opção [v,t] | CLIENTE FIXO | Cliente Fixo |  | caixa alta |
| app.js:8942 | opção [v,t] | CLIENTE EVENTUAL | Cliente Eventual |  | caixa alta |
| app.js:8944 | placeholder | 000.000.000-00 ou 00.000.000/0000-00 | 000.000.000-00 Ou 00.000.000/0000-00 |  |  |
| app.js:8950 | fi() | 🎯 Vendedor responsável (C.A.C.) | 🎯 Vendedor Responsável (C.A.C.) |  |  |
| app.js:8951 | fi() | Entregador bloqueado | Entregador Bloqueado |  |  |
| app.js:8952 | texto-html | Ativo no App Let's Go Cliente | Ativo no app Let's Go cliente |  | frase |

### Início da loja (carrossel)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:13003 | botao: | Ver planos | Ver Planos |  | **não alterar: texto do carrossel aprovado por você** |
| app.js:13008 | titulo: | Entrega Dedicada: garanta entregadores fixos na sua loja | Entrega Dedicada: Garanta Entregadores Fixos na Sua Loja |  | **não alterar: texto do carrossel aprovado por você** |
| app.js:13013 | titulo: | Você já conhece as vantagens do crédito pré-pago? | Você Já Conhece as Vantagens do Crédito Pré-pago? | Você Já Conhece As Vantagens do Crédito Pré-pago? | **não alterar: texto do carrossel aprovado por você** |
| app.js:13014 | botao: | Recarregar agora | Recarregar Agora |  | **não alterar: texto do carrossel aprovado por você** |
| app.js:13015 | titulo: | Acompanhe seus clientes | Acompanhe Seus Clientes |  | **não alterar: texto do carrossel aprovado por você** |
| app.js:13015 | botao: | Ver meus clientes | Ver Meus Clientes |  | **não alterar: texto do carrossel aprovado por você** |
| app.js:13016 | titulo: | Acompanhe seu desempenho | Acompanhe Seu Desempenho |  | **não alterar: texto do carrossel aprovado por você** |
| app.js:13016 | botao: | Ver desempenho | Ver Desempenho |  | **não alterar: texto do carrossel aprovado por você** |

### Novo Pedido

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:2718 | texto-html | ⚠️ Loja sem coordenadas GPS | ⚠️ Loja Sem Coordenadas GPS |  |  |
| app.js:2772 | label: | Chegou no local | Chegou no Local |  |  |
| app.js:2773 | label: | Em rota | Em Rota |  |  |
| app.js:2774 | label: | Chegou no destino | Chegou no Destino |  |  |
| app.js:7207 | texto-html | Plataforma de origem | Plataforma de Origem |  |  |
| app.js:7207 | texto-html | Endereço de entrega | Endereço de Entrega |  |  |
| app.js:7207 | placeholder | Rua, número, bairro | Rua, Número, Bairro |  |  |
| app.js:7207 | placeholder | Apto, bloco, ponto de referência | Apto, Bloco, Ponto de Referência |  |  |

### Visão Executiva

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:7859 | texto-html | Pedidos finalizados (eixo direito) | Pedidos Finalizados (eixo direito) |  |  |
| app.js:7860 | texto-html | · passe o mouse no gráfico pra ver o valor exato | · Passe o mouse no gráfico pra ver o valor exato |  | frase |
| app.js:8352 | texto-html | 📈 Crescimento da empresa | 📈 Crescimento da Empresa |  |  |
| app.js:8354 | texto-html | 7 dias | 7 Dias |  |  |
| app.js:8355 | texto-html | 30 dias | 30 Dias |  |  |
| app.js:8356 | texto-html | 6 meses | 6 Meses |  |  |
| app.js:8357 | texto-html | 12 meses | 12 Meses |  |  |
| app.js:8417 | texto-html | ✓ Tudo sob controle | ✓ Tudo Sob Controle |  |  |

### Configuração → iFood

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:12563 | texto-html | ▲ Mostrar só recentes | ▲ Mostrar Só Recentes |  |  |
| app.js:12577 | texto-html | ❌ Erro ao carregar lojas | ❌ Erro ao Carregar Lojas | ❌ Erro Ao Carregar Lojas |  |
| app.js:12583 | texto-html | Nenhuma loja vinculada ainda. Clique em "➕ Adicionar integração" pra vincular a primeira. | Nenhuma loja vinculada ainda. Clique em "➕ adicionar integração" pra vincular a primeira. |  | frase |
| app.js:12622 | texto-html | ❌ Esse Merchant ID já está vinculado a outra loja | ❌ Esse merchant ID já está vinculado a outra loja |  | frase |
| app.js:12647 | texto-html | 🏪 Buscar loja | 🏪 Buscar Loja |  |  |
| app.js:12696 | texto-html | Informe o Merchant ID | Informe o merchant ID |  | frase |
| app.js:12702 | texto-html | ❌ Esse Merchant ID já está vinculado a outra loja | ❌ Esse merchant ID já está vinculado a outra loja |  | frase |

### Fatura (detalhe)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:11709 | texto-html | Cobrança não encontrada | Cobrança Não Encontrada |  |  |
| app.js:11764 | texto-html | FATURA | Fatura |  | caixa alta |
| app.js:11785 | texto-html | Instruções de pagamento | Instruções de Pagamento |  |  |
| app.js:11788 | texto-html | PIX | Pix |  | caixa alta |
| app.js:11800 | texto-html | TOTAL | Total |  | caixa alta |
| app.js:11805 | texto-html | Valor original | Valor Original |  |  |
| app.js:11808 | texto-html | Total atualizado | Total Atualizado |  |  |

### Página de rastreio (cliente final)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:13604 | texto-html | PREVISÃO DE ENTREGA | Previsão de Entrega |  | caixa alta |
| app.js:13633 | texto-html | CÓDIGO PRA ENTREGA | Código pra Entrega | Código Pra Entrega | caixa alta |
| app.js:13638 | texto-html | Precisa De Suporte Com Sua Entrega? | Precisa de suporte com sua entrega? |  | frase |
| app.js:13638 | texto-html | Qualquer Dúvida, Nossa Equipe Está À Disposição. | Qualquer dúvida, nossa equipe está À disposição. |  | frase |
| app.js:13680 | texto-html | Pedido Entregue! | Pedido entregue! |  | frase |
| app.js:13683 | texto-html | Avalie Nosso App Na Play Store | Avalie nosso app na Play Store |  | frase |
| app.js:13685 | texto-html | ⭐ Avaliar Na Play Store | ⭐ Avaliar na Play Store |  |  |

### Gerar Cobranças

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:11416 | texto-html | Data início | Data Início |  |  |
| app.js:11421 | texto-html | Data fim | Data Fim |  |  |
| app.js:11461 | texto-html | Carregar mais | Carregar Mais |  |  |
| app.js:11466 | texto-html | Carregar mais | Carregar Mais |  |  |
| app.js:11495 | texto-html | TOTAL A COBRAR DAS LOJAS | Total a Cobrar das Lojas |  | caixa alta |
| app.js:11532 | texto-html | Selecionar todas | Selecionar Todas |  |  |

### Início da loja

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:13129 | texto-html | Conteúdos para você | Conteúdos para Você |  |  |
| app.js:13139 | texto-html | Comece por aqui | Comece por Aqui | Comece Por Aqui |  |
| app.js:13142 | texto-html | Crie uma entrega | Crie uma Entrega | Crie Uma Entrega |  |
| app.js:13144 | texto-html | Resumo de hoje | Resumo de Hoje |  |  |
| app.js:13164 | texto-html | Pedidos hoje | Pedidos Hoje |  |  |
| app.js:13165 | texto-html | Faturamento hoje | Faturamento Hoje |  |  |

### Pedidos (editar pedido)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:4983 | texto-html | Endereço de entrega | Endereço de Entrega |  |  |
| app.js:5009 | texto-html | Endereço de coleta | Endereço de Coleta |  |  |
| app.js:5009 | placeholder | Rua, número, bairro | Rua, Número, Bairro |  |  |
| app.js:5011 | texto-html | Contato na coleta | Contato na Coleta |  |  |
| app.js:5012 | texto-html | Telefone da coleta | Telefone da Coleta |  |  |
| app.js:5022 | texto-html | Data e hora | Data e Hora |  |  |

### Tabelas de Preço

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:12877 | title-attr | Clonar tabela | Clonar Tabela |  |  |
| app.js:12887 | texto-html | Com retorno | Com Retorno |  |  |
| app.js:12887 | texto-html | /km | /Km |  |  |
| app.js:12912 | texto-html | Km até | Km Até |  |  |
| app.js:12912 | texto-html | /km percorrido além do último range | /Km percorrido além do último range |  | frase |
| app.js:12933 | texto-html | Km até | Km Até |  |  |

### Cadastros → Importar lojas

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:5772 | texto-html | . CPF/CNPJ, e-mail e senha ficam pendentes — cada loja importada aparece com o selo "⚠️ Dados pendentes" pra você completar individualmente depois em Editar Loja. | . CPF/CNPJ, e-mail e senha ficam pendentes — cada loja importada aparece com o selo "⚠️ dados pendentes" pra você completar individualmente depois em editar loja. |  | frase |
| app.js:5775 | texto-html | Planilha preenchida (.csv) | Planilha Preenchida (.csv) |  |  |
| app.js:5780 | texto-html | Confirmar importação | Confirmar Importação |  |  |
| app.js:5860 | texto-html | (sem WhatsApp) | (Sem WhatsApp) |  | frase |
| app.js:5860 | title-attr | Vai entrar como Dados pendentes, complete depois em Editar Loja | Vai entrar como dados pendentes, complete depois em editar loja |  | frase |

### Configuração → Integrações

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:12462 | label: | Não iniciado | Não Iniciado |  |  |
| app.js:12463 | label: | Em andamento | Em Andamento |  |  |
| app.js:12476 | texto-html | 🧩 Outras plataformas | 🧩 Outras Plataformas |  |  |
| app.js:12512 | texto-html | 🏪 Vínculo de Lojas — iFood | 🏪 Vínculo de lojas — iFood |  | frase |
| app.js:12515 | texto-html | Vincula cada loja ao Merchant ID do app do iFood (Portal do Desenvolvedor → seu app → Merchant UUID). Sem isso, pedidos vindos do iFood não sabem de qual loja são nem o endereço de coleta. Só aparecem aqui as lojas já vinculadas. | Vincula cada loja ao merchant ID do app do iFood (Portal do desenvolvedor → seu app → merchant UUID). Sem isso, pedidos vindos do iFood não sabem de qual loja são nem o endereço de coleta. Só aparecem aqui as lojas já vinculadas. |  | frase |

### Preço Dinâmico

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:6669 | texto-html | GLOBAL (TODAS AS CIDADES) | Global (Todas as Cidades) | Global (Todas As Cidades) | caixa alta |
| app.js:6674 | texto-html | POR CIDADE | Por Cidade |  | caixa alta |
| app.js:6980 | texto-html | ❌ Erro ao salvar | ❌ Erro ao Salvar | ❌ Erro Ao Salvar |  |
| app.js:7046 | texto-html | Selecionar todos | Selecionar Todos |  |  |
| app.js:7148 | texto-html | ❌ Erro ao salvar | ❌ Erro ao Salvar | ❌ Erro Ao Salvar |  |

### Boas-vindas da loja (removida)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:4166 | texto-html | ↗ Crescimento da loja | ↗ Crescimento da Loja |  | código sem uso |
| app.js:4168 | texto-html | 7 dias | 7 Dias |  | código sem uso |
| app.js:4169 | texto-html | 30 dias | 30 Dias |  | código sem uso |
| app.js:4170 | texto-html | 6 meses | 6 Meses |  | código sem uso |

### Configuração → Cliente

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:12359 | texto-html | Raio de agrupamento | Raio de Agrupamento |  |  |
| app.js:12368 | texto-html | Máximo de pedidos por rota | Máximo de Pedidos por Rota | Máximo de Pedidos Por Rota |  |
| app.js:12374 | texto-html | Tempo de espera para agrupar | Tempo de Espera para Agrupar |  |  |
| app.js:12435 | texto-html | ❌ Erro ao salvar | ❌ Erro ao Salvar | ❌ Erro Ao Salvar |  |

### Entrega Dedicada

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:10542 | texto-html | Só vagas preenchidas | Só Vagas Preenchidas |  |  |
| app.js:10605 | texto-html | HOJE | Hoje |  | caixa alta |
| app.js:10655 | texto-html | Dia já passou | Dia Já Passou |  |  |
| app.js:10769 | texto-html | CPF do motoboy | CPF do Motoboy |  |  |

### Menu lateral

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:171 | label: | Perfil da loja | Perfil da Loja |  |  |
| app.js:175 | label: | Formas de pagamento | Formas de Pagamento |  |  |
| app.js:176 | label: | Dados bancários | Dados Bancários |  |  |
| app.js:179 | label: | Minha conta | Minha Conta |  |  |

### Recarga de saldo (modal)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:3380 | texto-html | Recarregar saldo via Pix | Recarregar Saldo Via Pix |  |  |
| app.js:3382 | texto-html | Saldo atual | Saldo Atual |  |  |
| app.js:3401 | texto-html | Recomendado · Ideal para começar | Recomendado · Ideal para Começar |  |  |
| app.js:3412 | aria-label | Valor da recarga | Valor da Recarga |  |  |

### Aprovar Cobranças

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:11573 | texto-html | Data início | Data Início |  |  |
| app.js:11575 | texto-html | Data fim | Data Fim |  |  |
| app.js:11608 | texto-html | Selecionar todas | Selecionar Todas |  |  |

### Aprovar Saques

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:10964 | texto-html | Carregar mais | Carregar Mais |  |  |
| app.js:10969 | texto-html | Carregar mais | Carregar Mais |  |  |
| app.js:11138 | texto-html | Saques pendentes de aprovação | Saques Pendentes de Aprovação |  |  |

### Cancelamento iFood

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:3577 | texto-html | Cancelar pedido iFood | Cancelar Pedido iFood |  |  |
| app.js:3594 | texto-html | Confirmar cancelamento | Confirmar Cancelamento |  |  |
| app.js:3609 | texto-html | Erro de conexão | Erro de Conexão |  |  |

### Configuração → Operação

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:12735 | texto-html | Tempo de exibição por entregador | Tempo de Exibição por Entregador | Tempo de Exibição Por Entregador |  |
| app.js:12769 | texto-html | Tempo de reset | Tempo de Reset |  |  |
| app.js:12788 | texto-html | Raio Limite de Despacho (por cidade) | Raio limite de despacho (por cidade) |  | frase |

### Notificações (disparo)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:12151 | texto-html | 14 disparos automáticos (7 dias × 2 horários fixos, 09:09 e 18:18 Brasília) — cada card é independente, com seu próprio texto. Card com título/mensagem vazio simplesmente não dispara nesse dia. Sem botão de "enviar a todos" aqui — são só automáticos, use "Testar" pra conferir o texto antes. | 14 Disparos automáticos (7 dias × 2 horários fixos, 09:09 e 18:18 brasília) — cada card é independente, com seu próprio texto. Card com título/mensagem vazio simplesmente não dispara nesse dia. Sem botão de "enviar a todos" aqui — são só automáticos, use "Testar" pra conferir o texto antes. |  | frase |
| app.js:12253 | texto-html | ❌ Erro ao salvar | ❌ Erro ao Salvar | ❌ Erro Ao Salvar |  |
| app.js:12299 | texto-html | ❌ Erro ao enviar | ❌ Erro ao Enviar | ❌ Erro Ao Enviar |  |

### Novo Entregador

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:6589 | texto-html | Nome completo | Nome Completo |  |  |
| app.js:6589 | texto-html | Senha inicial | Senha Inicial |  |  |
| app.js:6589 | placeholder | Mínimo 6 caracteres | Mínimo 6 Caracteres |  |  |

### WhatsApp Financeiro

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:11959 | notif | ℹ️ Sem lojas com WhatsApp Financeiro | ℹ️ Sem lojas com WhatsApp financeiro |  | frase |
| app.js:11999 | texto-html | Mensagem não pode ser vazia | Mensagem Não Pode Ser Vazia |  |  |
| app.js:12085 | texto-html | Enviado automaticamente toda | Enviado Automaticamente Toda |  |  |

### Cadastros → Entregadores

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:6158 | texto-html | PIX | Pix |  | caixa alta |
| app.js:6158 | texto-html | Data cadastro | Data Cadastro |  |  |

### Cadastros → Estabelecimentos

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:5636 | texto-html | E-mail acesso | E-mail Acesso |  |  |
| app.js:5999 | texto-html | ⚠️ Dados pendentes | ⚠️ Dados Pendentes |  |  |

### Desempenho

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:8857 | label: | Em rota | Em Rota |  |  |
| app.js:8858 | label: | Chegou no destino | Chegou no Destino |  |  |

### Lojas

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:8906 | texto-html | E-mail acesso | E-mail Acesso |  |  |
| app.js:8909 | texto-html | ⚠️ Dados pendentes | ⚠️ Dados Pendentes |  |  |

### Pedidos (comanda)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:11865 | texto-html | CÓDIGO DE COLETA (iFOOD) | Código de Coleta (iFOOD) |  |  |
| app.js:11877 | texto-html | TOTAL | Total |  | caixa alta |

### Pedidos (detalhes)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:3679 | texto-html | PREVISÃO DE ENTREGA | Previsão de Entrega |  | caixa alta |
| app.js:3720 | texto-html | 🔗 Copiar link de rastreio | 🔗 Copiar Link de Rastreio |  |  |

### Cardápio digital

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:13367 | texto-html | Clique em "+ Novo Produto". | Clique em "+ novo produto". |  | frase |

### Configuração

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:12329 | texto-html | Em breve | Em Breve |  |  |

### Integrações (em breve)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:3920 | texto-html | Em breve | Em Breve |  |  |

### Pedidos (código iFood)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:3625 | placeholder | Código informado pelo motoboy | Código Informado pelo Motoboy | Código Informado Pelo Motoboy |  |

### Relatórios

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:9695 | texto-html | Todas as lojas | Todas as Lojas | Todas As Lojas |  |
