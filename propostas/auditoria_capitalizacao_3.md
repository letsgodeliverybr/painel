# Auditoria de capitalização (3ª): Title Case total

Varredura de 01/10/2026 no `app.js`, `hostinger/index.html` e `hostinger/novoparceiro/index.html`, incluindo textos montados com variáveis, mensagens de erro e sucesso, `confirm`/`alert`, o carrossel (6 slides) e o cadastro em etapas. **Só leitura: nada foi alterado.**

**867 textos fora da regra**: 850 propostos para troca e 17 fora (nomes de loja usados como dado e código sem uso).

## Regra

- Toda palavra começa com maiúscula, inclusive preposições e artigos ("Comece Por Aqui", "Resumo De Hoje").
- Mantidos como estão: siglas (CPF, CNPJ, PIX, API, KM, SLA…), iFood, WhatsApp, Let's Go, palavras com número (24h, 2MB, #123), unidades (km, min, h, x), e-mails, URLs, tudo dentro de `${…}` (dados do banco) e opções de lista cujo valor é gravado no banco (categorias).
- Texto em MAIÚSCULAS com 2+ palavras vira Title Case; palavra única em maiúsculas (sigla ou ênfase, ex.: "TODOS") fica.
- Palavra com hífen: cada parte com maiúscula ("Pré-Pago"), exceto "E-mail".

## Por tela

| Tela | Qtd |
|---|---|
| Gestor de Pedidos / Mapa | 43 |
| HTML do Hostinger (login e modais fixos) | 41 |
| Pedidos | 31 |
| Início da loja (carrossel) | 23 |
| Editar Loja | 22 |
| Entrega Dedicada | 22 |
| Créditos | 18 |
| Notificações (disparo) | 18 |
| Clientes (loja) | 18 |
| Recarga de saldo (modal) | 17 |
| _criarPedidoInterno | 17 |
| C.A.C. | 15 |
| WhatsApp Financeiro | 15 |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | 14 |
| Novo Pedido | 14 |
| Contas a Pagar | 14 |
| Configuração → Operação | 14 |
| Cadastro de loja em etapas | 13 |
| Visão Executiva | 12 |
| Financeiro da loja | 12 |
| Editar Entregador | 11 |
| Início da loja | 11 |
| salvarEdicaoEntregador | 10 |
| Cadastros → Importar lojas | 9 |
| Preço Dinâmico | 9 |
| Desempenho | 9 |
| _buscarMetricas | 9 |
| Configuração → Cliente | 9 |
| Menu lateral | 8 |
| Cadastros → Entregadores | 8 |
| enviarCadastroLoja | 8 |
| Configuração → iFood | 8 |
| Cancelamento iFood | 7 |
| Pedidos (editar pedido) | 7 |
| criarNovoEntregador | 7 |
| Tabelas de Preço | 7 |
| Página de rastreio (cliente final) | 7 |
| _confirmarEntregaParceira | 6 |
| Alocar Motoboy | 6 |
| Cadastros → Estabelecimentos | 6 |
| Gerar Cobranças | 6 |
| _recalcularEnderecosDadosPendentes | 5 |
| salvarEdicaoUsuario | 5 |
| Pedidos (linha do tempo) | 5 |
| _salvarMeta | 5 |
| Gerar Pagamentos | 5 |
| recusarSaque | 5 |
| recusarSaqueRapido | 5 |
| _enviarFaturaHistorico | 5 |
| Fatura (detalhe) | 5 |
| _mcAbrirModalProduto | 5 |
| _mcSalvarProduto | 5 |
| _ifoodValidarCodigo | 4 |
| Pedidos (detalhes) | 4 |
| Boas-vindas da loja (removida) | 4 |
| salvarEdicaoPedido | 4 |
| alocarMotoboy | 4 |
| _renderPrecoDinamicoTab | 4 |
| alterarStatusPedidoRelatorio | 4 |
| _runAuditoria | 4 |
| _gerarPagamento | 4 |
| Saque Rápido | 4 |
| Aprovar Cobranças | 4 |
| Configuração → Integrações | 4 |
| salvarKmAdicional | 4 |
| _ifoodResponderTroca | 3 |
| fazerLogin | 3 |
| _confirmarReprovacaoLoja | 3 |
| _renderClientesAppTab | 3 |
| _toggleStatusEntregador | 3 |
| _confirmarReprovacao | 3 |
| _recarregarListaLojas | 3 |
| _confirmarReprovacaoDocumento | 3 |
| Lojas | 3 |
| _renderRankingLista | 3 |
| Pedidos (comanda) | 3 |
| clonarTabela | 3 |
| _mcSalvarCategoria | 3 |
| Cadastre sua loja (/novoparceiro) | 3 |
| _enviarMensagemChat | 2 |
| _abrirChatLoja | 2 |
| _carregarListaConversasAdmin | 2 |
| _copiarCodigoPix | 2 |
| confirmarPagamento | 2 |
| goTab | 2 |
| _lojaSetPeriodoCrescimento | 2 |
| calcularDistanciaRota | 2 |
| _confirmarImportarLojas | 2 |
| _aprovarEntregador | 2 |
| excluirEntregador | 2 |
| excluirLoja | 2 |
| _aprovarDocumento | 2 |
| _renderUsuariosTab | 2 |
| abrirEditarUsuario | 2 |
| _fetchPdAtual | 2 |
| _renderVendedoresTab | 2 |
| salvarVendedor | 2 |
| Relatórios | 2 |
| renderLogsPage | 2 |
| _claCardHtml | 2 |
| _criarCla | 2 |
| _feriadoSalvar | 2 |
| Aprovar Saques | 2 |
| _renderHistoricoAprovarSaques | 2 |
| _aprovarSaquesSelecionados | 2 |
| _srSalvarCaixa | 2 |
| _aprovarSaquesRapidosSelecionados | 2 |
| _renderHistoricoSaqueRapido | 2 |
| _gerarCobranca | 2 |
| _renderHistoricoCobrancas | 2 |
| _aprovarCobrancasSelecionadas | 2 |
| _aprovarCobrancaUnica | 2 |
| recusarCobranca | 2 |
| _salvarConfigEvolution | 2 |
| salvarNovaTabela | 2 |
| renomearTabela | 2 |
| _cliCalcular | 2 |
| renderMeuCardapioPage | 2 |
| _mcCarregarCategorias | 2 |
| Cardápio digital | 2 |
| _mcPreviewFoto | 2 |
| _mcExcluirProduto | 2 |
| _renderMensagensChat | 1 |
| _abrirChatAdmin | 1 |
| _abrirConversaAdmin | 1 |
| _crCalcularTaxa | 1 |
| alterarStatusPedido | 1 |
| _htmlSobDemandaInline | 1 |
| _carregarSaldoTopbar | 1 |
| Pedidos (troca de endereço iFood) | 1 |
| Pedidos (código iFood) | 1 |
| _renderLojaChartCrescimento | 1 |
| _verificarAgendados | 1 |
| renderTabelaMapa | 1 |
| _copiarRastreio | 1 |
| _offsetCoordDuplicada | 1 |
| _epRecalcularTaxas | 1 |
| _abrirDropdownCadastroLoja | 1 |
| _setCadastroStatusLoja | 1 |
| _reprovarLoja | 1 |
| _setCadastroStatus | 1 |
| Novo Entregador | 1 |
| _desativarPrecoDinamico | 1 |
| _desativarPdCidade | 1 |
| _escalaItem | 1 |
| _renderMetricasChart | 1 |
| _renderDonutCategoria | 1 |
| abrirDropdownStatusRelatorio | 1 |
| renderMotoboyPage | 1 |
| abrirModalUsuario | 1 |
| carregarRelatorio | 1 |
| renderAuditoriaPage | 1 |
| renderFinanceiroPage | 1 |
| _flBuscar | 1 |
| _renderClasTab | 1 |
| Ranking → Clãs | 1 |
| _claVerLista | 1 |
| _salvarCla | 1 |
| _feriadosBuscar | 1 |
| _feriadoExcluir | 1 |
| _dispararWhatsappEmRota | 1 |
| renderWhatsappPage | 1 |
| _renderConfigLogsIfood | 1 |
| _ifoodAddFiltrarLojas | 1 |
| _salvarConfigOperacao | 1 |
| renderTabelasPrecoPage | 1 |
| excluirFaixa | 1 |
| adicionarFaixa | 1 |
| salvarEdicaoFaixa | 1 |
| excluirTabela | 1 |
| renderLojaPedidosPage | 1 |
| _cliRenderLista | 1 |
| _mcAbrirModalCategoria | 1 |
| _mcToggleCategoria | 1 |
| _agruparPorProximidade | 1 |
| iniciarAutocompleteEndereco | 1 |

## Lista completa

| Tela | arquivo:linha | Atual | Proposto |
|---|---|---|---|
| Alocar Motoboy | app.js:5194 | Loja sem tabela | Loja Sem Tabela |
| Alocar Motoboy | app.js:5194 | Configure a tabela de cobrança/pagamento em Cadastros → Lojas antes de alocar. | Configure A Tabela De Cobrança/Pagamento Em Cadastros → Lojas Antes De Alocar. |
| Alocar Motoboy | app.js:5228 | Nenhum motoboy online | Nenhum Motoboy Online |
| Alocar Motoboy | app.js:5230 | Nenhum entregador disponível dentro de ${raioKm}km | Nenhum Entregador Disponível Dentro De ${raioKm}km |
| Alocar Motoboy | app.js:5242 | ⚠️ Esse pedido já tem um entregador em andamento. | ⚠️ Esse Pedido Já Tem Um Entregador Em Andamento. |
| Alocar Motoboy | app.js:5242 | Escolher outro abaixo vai desalocar o entregador atual (ele será avisado por notificação) e reabrir o pedido como disponível pro novo. | Escolher Outro Abaixo Vai Desalocar O Entregador Atual (Ele Será Avisado Por Notificação) E Reabrir O Pedido Como Disponível Pro Novo. |
| Aprovar Cobranças | app.js:11771 | Carregando histórico... | Carregando Histórico... |
| Aprovar Cobranças | app.js:11786 | Selecione o período | Selecione O Período |
| Aprovar Cobranças | app.js:11793 | Nenhuma cobrança pendente no período | Nenhuma Cobrança Pendente No Período |
| Aprovar Cobranças | app.js:11802 | Gerado em | Gerado Em |
| Aprovar Saques | app.js:11137 | Nenhum pagamento gerado ainda | Nenhum Pagamento Gerado Ainda |
| Aprovar Saques | app.js:11328 | Saques Pendentes de Aprovação | Saques Pendentes De Aprovação |
| Boas-vindas da loja (removida) | app.js:4189 | ↗ Crescimento da loja | ↗ Crescimento Da Loja |
| Boas-vindas da loja (removida) | app.js:4191 | 7 dias | 7 Dias |
| Boas-vindas da loja (removida) | app.js:4192 | 30 dias | 30 Dias |
| Boas-vindas da loja (removida) | app.js:4193 | 6 meses | 6 Meses |
| C.A.C. | app.js:7310 | ${_icone('target',22)} C.A.C. — Custo de Aquisição de Cliente | ${_icone('target',22)} C.A.C. — Custo De Aquisição De Cliente |
| C.A.C. | app.js:7327 | /pedido nos primeiros ${c.janela_bonus_dias} dias | /Pedido Nos Primeiros ${c.janela_bonus_dias} Dias |
| C.A.C. | app.js:7328 | — (Sem meta) | — (Sem Meta) |
| C.A.C. | app.js:7328 | ❌ Não bateu | ❌ Não Bateu |
| C.A.C. | app.js:7332 | (inativo) | (Inativo) |
| C.A.C. | app.js:7340 | Nenhum vendedor cadastrado — cadastre em cadastros → vendedores. | Nenhum Vendedor Cadastrado — Cadastre Em Cadastros → Vendedores. |
| C.A.C. | app.js:7348 | / ${N(x.pedidosJanela)} na janela | / ${N(x.pedidosJanela)} Na Janela |
| C.A.C. | app.js:7350 | Dentro do Prazo | Dentro Do Prazo |
| C.A.C. | app.js:7351 | Nenhuma loja com vendedor responsável ainda — atribua em cadastros → estabelecimentos → editar loja. | Nenhuma Loja Com Vendedor Responsável Ainda — Atribua Em Cadastros → Estabelecimentos → Editar Loja. |
| C.A.C. | app.js:7354 | Resumo por Vendedor — ${mes}/${ano} | Resumo Por Vendedor — ${mes}/${ano} |
| C.A.C. | app.js:7355 | Pedidos na Janela | Pedidos Na Janela |
| C.A.C. | app.js:7355 | Bônus no Mês | Bônus No Mês |
| C.A.C. | app.js:7355 | Custo no Mês (fixo + bônus) | Custo No Mês (Fixo + Bônus) |
| C.A.C. | app.js:7356 | Lojas Novas por Vendedor | Lojas Novas Por Vendedor |
| C.A.C. | app.js:7357 | Pedidos (total / janela 90d) | Pedidos (Total / Janela 90d) |
| Cadastre sua loja (/novoparceiro) | hostinger/novoparceiro/index.html:6 | Cadastre sua loja \| Let's Go | Cadastre Sua Loja \| Let's Go |
| Cadastre sua loja (/novoparceiro) | hostinger/novoparceiro/index.html:32 | Carregando cadastro... | Carregando Cadastro... |
| Cadastre sua loja (/novoparceiro) | hostinger/novoparceiro/index.html:33 | Ative o JavaScript do navegador para se cadastrar. | Ative O JavaScript Do Navegador Para Se Cadastrar. |
| Cadastro de loja em etapas | app.js:9281 | Sobre a Sua Loja | Sobre A Sua Loja |
| Cadastro de loja em etapas | app.js:9282 | Onde Fica a Sua Loja | Onde Fica A Sua Loja |
| Cadastro de loja em etapas | app.js:9284 | Documento da Loja | Documento Da Loja |
| Cadastro de loja em etapas | app.js:9285 | Dados de Acesso | Dados De Acesso |
| Cadastro de loja em etapas | app.js:9455 | Voltar ao Login | Voltar Ao Login |
| Cadastro de loja em etapas | app.js:9477 | Cadastre sua loja e comece a vender com a | Cadastre Sua Loja E Comece A Vender Com A |
| Cadastro de loja em etapas | app.js:9478 | Escolha o tipo do seu negócio. O cadastro leva poucos minutos e nossa equipe analisa e libera o seu acesso. | Escolha O Tipo Do Seu Negócio. O Cadastro Leva Poucos Minutos E Nossa Equipe Analisa E Libera O Seu Acesso. |
| Cadastro de loja em etapas | app.js:9542 | Use pelo menos 6 caracteres. | Use Pelo Menos 6 Caracteres. |
| Cadastro de loja em etapas | app.js:9625 | Escolher o endereço na lista ajuda a localizar sua loja no mapa. | Escolher O Endereço Na Lista Ajuda A Localizar Sua Loja No Mapa. |
| Cadastro de loja em etapas | app.js:9676 | Localizando endereço... | Localizando Endereço... |
| Cadastro de loja em etapas | app.js:9684 | Cadastro enviado! | Cadastro Enviado! |
| Cadastro de loja em etapas | app.js:9684 | Nossa equipe vai analisar e liberar seu acesso. Assim que for aprovado, é só entrar com o e-mail e a senha que você cadastrou. | Nossa Equipe Vai Analisar E Liberar Seu Acesso. Assim Que For Aprovado, É Só Entrar Com O E-mail E A Senha Que Você Cadastrou. |
| Cadastro de loja em etapas | app.js:9685 | ${_icone('arrow-left',18)}Voltar ao Login | ${_icone('arrow-left',18)}Voltar Ao Login |
| Cadastros → Entregadores | app.js:6136 | Buscar nome ou CPF... | Buscar Nome Ou CPF... |
| Cadastros → Entregadores | app.js:6183 | Nenhum entregador em análise | Nenhum Entregador Em Análise |
| Cadastros → Entregadores | app.js:6206 | Nenhum entregador | Nenhum Entregador |
| Cadastros → Entregadores | app.js:6234 | ❌ Erro ao atualizar disponibilidade | ❌ Erro Ao Atualizar Disponibilidade |
| Cadastros → Entregadores | app.js:6256 | ⚠️ Ligado, mas sem GPS | ⚠️ Ligado, Mas Sem GPS |
| Cadastros → Entregadores | app.js:6256 | Esse entregador só volta a aparecer no mapa depois que ele mesmo abrir o app — esse botão não reinicia o GPS pelo celular dele. | Esse Entregador Só Volta A Aparecer No Mapa Depois Que Ele Mesmo Abrir O App — Esse Botão Não Reinicia O GPS Pelo Celular Dele. |
| Cadastros → Entregadores | app.js:6258 | 🟢 Entregador online | 🟢 Entregador Online |
| Cadastros → Entregadores | app.js:6258 | ⚫ Entregador offline | ⚫ Entregador Offline |
| Cadastros → Estabelecimentos | app.js:5659 | Buscar loja... | Buscar Loja... |
| Cadastros → Estabelecimentos | app.js:5659 | ${_icone('upload',16,'btn-ico')}Importar Rede de Lojas | ${_icone('upload',16,'btn-ico')}Importar Rede De Lojas |
| Cadastros → Estabelecimentos | app.js:5659 | ${_icone('refresh-cw',16,'btn-ico')}Recalcular Endereços em Massa | ${_icone('refresh-cw',16,'btn-ico')}Recalcular Endereços Em Massa |
| Cadastros → Estabelecimentos | app.js:6019 | Nenhuma loja | Nenhuma Loja |
| Cadastros → Estabelecimentos | app.js:6022 | Telefone ainda é placeholder de importação — edite a loja pra completar | Telefone Ainda É Placeholder De Importação — Edite A Loja Pra Completar |
| Cadastros → Estabelecimentos | app.js:6023 | Financeiro da Loja | Financeiro Da Loja |
| Cadastros → Importar lojas | app.js:5793 | ${_icone('upload',18)} Importar Rede de Lojas | ${_icone('upload',18)} Importar Rede De Lojas |
| Cadastros → Importar lojas | app.js:5797 | Cidade/Estado padrão (pra geocodificar endereços sem cidade no texto) | Cidade/Estado Padrão (Pra Geocodificar Endereços Sem Cidade No Texto) |
| Cadastros → Importar lojas | app.js:5798 | Planilha Preenchida (.csv) | Planilha Preenchida (.Csv) |
| Cadastros → Importar lojas | app.js:5818 | Arquivo vazio ou ilegível. | Arquivo Vazio Ou Ilegível. |
| Cadastros → Importar lojas | app.js:5865 | ❌ ${comErro.length} com erro | ❌ ${comErro.length} Com Erro |
| Cadastros → Importar lojas | app.js:5866 | ⚠️ ${comDuplicata.length} possível duplicata | ⚠️ ${comDuplicata.length} Possível Duplicata |
| Cadastros → Importar lojas | app.js:5868 | Linhas marcadas em amarelo parecem já existir no sistema (mesmo endereço ou nome parecido) — confira antes de confirmar. Isso não bloqueia a importação, é só um aviso. | Linhas Marcadas Em Amarelo Parecem Já Existir No Sistema (Mesmo Endereço Ou Nome Parecido) — Confira Antes De Confirmar. Isso Não Bloqueia A Importação, É Só Um Aviso. |
| Cadastros → Importar lojas | app.js:5883 | Parece com uma loja já cadastrada | Parece Com Uma Loja Já Cadastrada |
| Cadastros → Importar lojas | app.js:5883 | Vai entrar como dados pendentes, complete depois em editar loja | Vai Entrar Como Dados Pendentes, Complete Depois Em Editar Loja |
| Cancelamento iFood | app.js:3602 | ⏳ Buscando motivos de cancelamento... | ⏳ Buscando Motivos De Cancelamento... |
| Cancelamento iFood | app.js:3612 | Selecione o motivo do cancelamento pro iFood: | Selecione O Motivo Do Cancelamento Pro iFood: |
| Cancelamento iFood | app.js:3614 | Nenhum motivo disponível | Nenhum Motivo Disponível |
| Cancelamento iFood | app.js:3623 | Selecione um motivo | Selecione Um Motivo |
| Cancelamento iFood | app.js:3630 | Cancelamento solicitado | Cancelamento Solicitado |
| Cancelamento iFood | app.js:3630 | Aguardando confirmação do iFood | Aguardando Confirmação Do iFood |
| Cancelamento iFood | app.js:3632 | Erro de Conexão | Erro De Conexão |
| Cardápio digital | app.js:13557 | Nenhum produto nesta categoria. | Nenhum Produto Nesta Categoria. |
| Cardápio digital | app.js:13557 | Clique em "+ novo produto". | Clique Em "+ Novo Produto". |
| Clientes (loja) | app.js:13430 | Nenhuma loja associada ao seu usuário. | Nenhuma Loja Associada Ao Seu Usuário. |
| Clientes (loja) | app.js:13437 | Ainda não há clientes para mostrar | Ainda Não Há Clientes Para Mostrar |
| Clientes (loja) | app.js:13437 | Assim que sua loja tiver pedidos finalizados nos últimos 90 dias, você vai ver aqui quantos clientes atendeu, quantos são novos e quem pede com mais frequência. | Assim Que Sua Loja Tiver Pedidos Finalizados Nos Últimos 90 Dias, Você Vai Ver Aqui Quantos Clientes Atendeu, Quantos São Novos E Quem Pede Com Mais Frequência. |
| Clientes (loja) | app.js:13452 | Dia com Mais Pedidos | Dia Com Mais Pedidos |
| Clientes (loja) | app.js:13452 | ${N(maxDow)} pedido(s) nos últimos 90 dias | ${N(maxDow)} Pedido(s) Nos Últimos 90 Dias |
| Clientes (loja) | app.js:13453 | ${N(m.topItem[1])} unidade(s) nos últimos 90 dias | ${N(m.topItem[1])} Unidade(s) Nos Últimos 90 Dias |
| Clientes (loja) | app.js:13456 | Clientes identificados pelo telefone (ou nome + endereço quando não há telefone), contando só pedidos finalizados da sua loja. | Clientes Identificados Pelo Telefone (Ou Nome + Endereço Quando Não Há Telefone), Contando Só Pedidos Finalizados Da Sua Loja. |
| Clientes (loja) | app.js:13458 | Clientes (90 dias) | Clientes (90 Dias) |
| Clientes (loja) | app.js:13458 | ${N(m.pedidos90)} pedidos finalizados | ${N(m.pedidos90)} Pedidos Finalizados |
| Clientes (loja) | app.js:13459 | Clientes Novos (30 dias) | Clientes Novos (30 Dias) |
| Clientes (loja) | app.js:13459 | fizeram o primeiro pedido nesse período | Fizeram O Primeiro Pedido Nesse Período |
| Clientes (loja) | app.js:13460 | Pediram 2x ou Mais (30 dias) | Pediram 2x Ou Mais (30 Dias) |
| Clientes (loja) | app.js:13463 | Evolução de Clientes por Semana | Evolução De Clientes Por Semana |
| Clientes (loja) | app.js:13464 | que já compravam | Que Já Compravam |
| Clientes (loja) | app.js:13466 | Últimas 13 semanas · cada barra é uma semana (clientes diferentes que pediram) | Últimas 13 Semanas · Cada Barra É Uma Semana (Clientes Diferentes Que Pediram) |
| Clientes (loja) | app.js:13468 | Hábitos de Compra | Hábitos De Compra |
| Clientes (loja) | app.js:13471 | Clientes Mais Frequentes (90 dias) | Clientes Mais Frequentes (90 Dias) |
| Clientes (loja) | app.js:13472 | Buscar por nome ou final do telefone... | Buscar Por Nome Ou Final Do Telefone... |
| Configuração → Cliente | app.js:12535 | Selecione a loja... | Selecione A Loja... |
| Configuração → Cliente | app.js:12545 | Agrupa pedidos próximos em uma única rota antes de despachar ao entregador. | Agrupa Pedidos Próximos Em Uma Única Rota Antes De Despachar Ao Entregador. |
| Configuração → Cliente | app.js:12549 | Raio de Agrupamento | Raio De Agrupamento |
| Configuração → Cliente | app.js:12550 | Distância máxima entre pedidos para considerá-los na mesma rota. | Distância Máxima Entre Pedidos Para Considerá-Los Na Mesma Rota. |
| Configuração → Cliente | app.js:12558 | Máximo de Pedidos por Rota | Máximo De Pedidos Por Rota |
| Configuração → Cliente | app.js:12564 | Tempo de Espera para Agrupar | Tempo De Espera Para Agrupar |
| Configuração → Cliente | app.js:12565 | Segundos que o sistema aguarda novos pedidos antes de montar a rota. | Segundos Que O Sistema Aguarda Novos Pedidos Antes De Montar A Rota. |
| Configuração → Cliente | app.js:12612 | Selecione uma loja antes de salvar | Selecione Uma Loja Antes De Salvar |
| Configuração → Cliente | app.js:12625 | ❌ Erro ao Salvar | ❌ Erro Ao Salvar |
| Configuração → Integrações | app.js:12667 | Integrações planejadas — cada card muda de status conforme a gente for implementando, uma por uma. | Integrações Planejadas — Cada Card Muda De Status Conforme A Gente For Implementando, Uma Por Uma. |
| Configuração → Integrações | app.js:12674 | Cardápio Digital / PDV e Gestão | Cardápio Digital / PDV E Gestão |
| Configuração → Integrações | app.js:12702 | 🏪 Vínculo de Lojas — iFood | 🏪 Vínculo De Lojas — iFood |
| Configuração → Integrações | app.js:12705 | Vincula cada loja ao merchant ID do app do iFood (Portal do desenvolvedor → seu app → merchant UUID). Sem isso, pedidos vindos do iFood não sabem de qual loja são nem o endereço de coleta. Só aparecem aqui as lojas já vinculadas. | Vincula Cada Loja Ao Merchant ID Do App Do iFood (Portal Do Desenvolvedor → Seu App → Merchant UUID). Sem Isso, Pedidos Vindos Do iFood Não Sabem De Qual Loja São Nem O Endereço De Coleta. Só Aparecem Aqui As Lojas Já Vinculadas. |
| Configuração → Operação | app.js:12909 | Modo de Despacho | Modo De Despacho |
| Configuração → Operação | app.js:12910 | Define como os pedidos são enviados aos entregadores disponíveis. | Define Como Os Pedidos São Enviados Aos Entregadores Disponíveis. |
| Configuração → Operação | app.js:12913 | Todos os disponíveis recebem ao mesmo tempo | Todos Os Disponíveis Recebem Ao Mesmo Tempo |
| Configuração → Operação | app.js:12922 | Configuração de Propagação | Configuração De Propagação |
| Configuração → Operação | app.js:12925 | Tempo de Exibição por Entregador | Tempo De Exibição Por Entregador |
| Configuração → Operação | app.js:12926 | Segundos que o pedido fica visível para cada entregador antes de passar ao próximo. | Segundos Que O Pedido Fica Visível Para Cada Entregador Antes De Passar Ao Próximo. |
| Configuração → Operação | app.js:12934 | Ondas de Propagação por Distância | Ondas De Propagação Por Distância |
| Configuração → Operação | app.js:12935 | Se nenhum entregador aceitar, o pedido é propagado em ondas crescentes de raio. | Se Nenhum Entregador Aceitar, O Pedido É Propagado Em Ondas Crescentes De Raio. |
| Configuração → Operação | app.js:12959 | Tempo de Reset | Tempo De Reset |
| Configuração → Operação | app.js:12960 | Após esse tempo sem aceite, reseta a busca e recomeça do início. Padrão: 10 min. | Após Esse Tempo Sem Aceite, Reseta A Busca E Recomeça Do Início. Padrão: 10 min. |
| Configuração → Operação | app.js:12969 | Raio de Busca de Entregadores | Raio De Busca De Entregadores |
| Configuração → Operação | app.js:12970 | Raio em km para buscar entregadores disponíveis próximos ao pedido. | Raio Em km Para Buscar Entregadores Disponíveis Próximos Ao Pedido. |
| Configuração → Operação | app.js:12978 | Raio limite de despacho (por cidade) | Raio Limite De Despacho (Por Cidade) |
| Configuração → Operação | app.js:12979 | Entregadores além deste raio não recebem o pedido, evitando despacho para outra cidade. Padrão: 32 km. | Entregadores Além Deste Raio Não Recebem O Pedido, Evitando Despacho Para Outra Cidade. Padrão: 32 km. |
| Configuração → iFood | app.js:12735 | Nenhum erro registrado. | Nenhum Erro Registrado. |
| Configuração → iFood | app.js:12767 | ❌ Erro ao Carregar Lojas | ❌ Erro Ao Carregar Lojas |
| Configuração → iFood | app.js:12773 | Nenhuma loja vinculada ainda. Clique em "➕ adicionar integração" pra vincular a primeira. | Nenhuma Loja Vinculada Ainda. Clique Em "➕ Adicionar Integração" Pra Vincular A Primeira. |
| Configuração → iFood | app.js:12812 | ❌ Esse merchant ID já está vinculado a outra loja | ❌ Esse Merchant ID Já Está Vinculado A Outra Loja |
| Configuração → iFood | app.js:12839 | Digite o nome da loja... | Digite O Nome Da Loja... |
| Configuração → iFood | app.js:12884 | Selecione uma loja primeiro | Selecione Uma Loja Primeiro |
| Configuração → iFood | app.js:12886 | Informe o merchant ID | Informe O Merchant ID |
| Configuração → iFood | app.js:12892 | ❌ Esse merchant ID já está vinculado a outra loja | ❌ Esse Merchant ID Já Está Vinculado A Outra Loja |
| Contas a Pagar | app.js:10188 | Cadastrar Conta a Pagar | Cadastrar Conta A Pagar |
| Contas a Pagar | app.js:10206 | Filtrar por Mês | Filtrar Por Mês |
| Contas a Pagar | app.js:10223 | Nenhuma conta cadastrada | Nenhuma Conta Cadastrada |
| Contas a Pagar | app.js:10245 | Preencha todos os campos obrigatórios | Preencha Todos Os Campos Obrigatórios |
| Contas a Pagar | app.js:10252 | ✅ Conta salva com sucesso! | ✅ Conta Salva Com Sucesso! |
| Contas a Pagar | app.js:10256 | ❌ Erro ao salvar | ❌ Erro Ao Salvar |
| Contas a Pagar | app.js:10270 | Editar conta a pagar | Editar Conta A Pagar |
| Contas a Pagar | app.js:10271 | Salvar edição | Salvar Edição |
| Contas a Pagar | app.js:10284 | Cadastrar conta a pagar | Cadastrar Conta A Pagar |
| Contas a Pagar | app.js:10289 | Excluir esta conta a pagar? | Excluir Esta Conta A Pagar? |
| Contas a Pagar | app.js:10291 | 🗑️ Conta excluída | 🗑️ Conta Excluída |
| Contas a Pagar | app.js:10314 | Todos os Tipos | Todos Os Tipos |
| Contas a Pagar | app.js:10314 | Débito de Entrega | Débito De Entrega |
| Contas a Pagar | app.js:10314 | Estorno de Entrega | Estorno De Entrega |
| Créditos | app.js:9996 | Buscar por nome... | Buscar Por Nome... |
| Créditos | app.js:10010 | Recarga Pix (valor pago pela loja) | Recarga Pix (Valor Pago Pela Loja) |
| Créditos | app.js:10010 | Ajuste Manual (crédito ou débito) | Ajuste Manual (Crédito Ou Débito) |
| Créditos | app.js:10071 | Nenhum registro encontrado | Nenhum Registro Encontrado |
| Créditos | app.js:10116 | Valor Pago pela Loja | Valor Pago Pela Loja |
| Créditos | app.js:10120 | Consultando regras da recarga... | Consultando Regras Da Recarga... |
| Créditos | app.js:10126 | Função de recarga indisponível no banco. | Função De Recarga Indisponível No Banco. |
| Créditos | app.js:10128 | Primeira recarga: mínimo ${_rcgFmtCurto(min)}. | Primeira Recarga: Mínimo ${_rcgFmtCurto(min)}. |
| Créditos | app.js:10129 | Math.abs(p.pago-valor) | Math.abs(p.pago-Valor) |
| Créditos | app.js:10131 | Bônus ativo até ${_rcgDM(j.fim)}. | Bônus Ativo Até ${_rcgDM(j.fim)}. |
| Créditos | app.js:10133 | Bônus Fora da Janela | Bônus Fora Da Janela |
| Créditos | app.js:10135 | Data do crédito: hoje. O bônus é calculado pelo servidor no momento do lançamento. | Data Do Crédito: Hoje. O Bônus É Calculado Pelo Servidor No Momento Do Lançamento. |
| Créditos | app.js:10156 | Escolha a loja e informe o valor pago | Escolha A Loja E Informe O Valor Pago |
| Créditos | app.js:10158 | Recarga não lançada | Recarga Não Lançada |
| Créditos | app.js:10161 | Recarga lançada | Recarga Lançada |
| Créditos | app.js:10166 | Preencha todos os campos obrigatórios | Preencha Todos Os Campos Obrigatórios |
| Créditos | app.js:10173 | ✅ Registro salvo com sucesso! | ✅ Registro Salvo Com Sucesso! |
| Créditos | app.js:10177 | ❌ Erro ao salvar | ❌ Erro Ao Salvar |
| Desempenho | app.js:8487 | 📊 Pedidos Finalizados por Mês | 📊 Pedidos Finalizados Por Mês |
| Desempenho | app.js:8491 | 🏪 Lojas Novas por Mês | 🏪 Lojas Novas Por Mês |
| Desempenho | app.js:8494 | 🛵 Motoboys Novos por Mês | 🛵 Motoboys Novos Por Mês |
| Desempenho | app.js:8499 | 🏷️ Lojas por Categoria | 🏷️ Lojas Por Categoria |
| Desempenho | app.js:8502 | 📦 Pedidos Finalizados por Categoria | 📦 Pedidos Finalizados Por Categoria |
| Desempenho | app.js:8511 | 🚀 Escala da Let's Go | 🚀 Escala Da Let's Go |
| Desempenho | app.js:8511 | Metas configuráveis chegam na próxima etapa | Metas Configuráveis Chegam Na Próxima Etapa |
| Desempenho | app.js:8865 | Sem detalhamento disponível | Sem Detalhamento Disponível |
| Desempenho | app.js:8881 | Chegou no Destino | Chegou No Destino |
| Editar Entregador | app.js:6441 | Não enviado | Não Enviado |
| Editar Entregador | app.js:6521 | ⚠️ Confirme o nome real do entregador | ⚠️ Confirme O Nome Real Do Entregador |
| Editar Entregador | app.js:6522 | Alterar requer confirmação — o entregador receberá um novo link de acesso | Alterar Requer Confirmação — O Entregador Receberá Um Novo Link De Acesso |
| Editar Entregador | app.js:6523 | Clã de Entregador | Clã De Entregador |
| Editar Entregador | app.js:6524 | Data de Nascimento | Data De Nascimento |
| Editar Entregador | app.js:6528 | Deixe em branco para não alterar | Deixe Em Branco Para Não Alterar |
| Editar Entregador | app.js:6531 | 🛵 Dados do Veículo | 🛵 Dados Do Veículo |
| Editar Entregador | app.js:6535 | 💰 Dados de Pagamento | 💰 Dados De Pagamento |
| Editar Entregador | app.js:6536 | Tipo de Pagamento | Tipo De Pagamento |
| Editar Entregador | app.js:6538 | Máquina de Cartão | Máquina De Cartão |
| Editar Entregador | app.js:6538 | Possui Máquina de Cartão | Possui Máquina De Cartão |
| Editar Loja | app.js:8959 | Nome do Estabelecimento | Nome Do Estabelecimento |
| Editar Loja | app.js:8965 | Tipo de Cliente | Tipo De Cliente |
| Editar Loja | app.js:8966 | WhatsApp da Loja | WhatsApp Da Loja |
| Editar Loja | app.js:8967 | CPF ou CNPJ | CPF Ou CNPJ |
| Editar Loja | app.js:8969 | Deixe em branco para não alterar | Deixe Em Branco Para Não Alterar |
| Editar Loja | app.js:8970 | Tabelas de Preço | Tabelas De Preço |
| Editar Loja | app.js:8971 | Tabela de Cobrança | Tabela De Cobrança |
| Editar Loja | app.js:8971 | Tabela de Pagamento Motoboy | Tabela De Pagamento Motoboy |
| Editar Loja | app.js:8972 | Tipo de Cobrança | Tipo De Cobrança |
| Editar Loja | app.js:8973 | 🛵 Limite de Pedidos Simultâneos | 🛵 Limite De Pedidos Simultâneos |
| Editar Loja | app.js:8975 | Ativo no app Let's Go cliente | Ativo No App Let's Go Cliente |
| Editar Loja | app.js:9007 | Não recebe pedido desta loja (despacho, aviso e aceite). Bloqueado por 3 lojas diferentes, é bloqueado na plataforma automaticamente. | Não Recebe Pedido Desta Loja (Despacho, Aviso E Aceite). Bloqueado Por 3 Lojas Diferentes, É Bloqueado Na Plataforma Automaticamente. |
| Editar Loja | app.js:9007 | Buscar entregador por nome ou telefone | Buscar Entregador Por Nome Ou Telefone |
| Editar Loja | app.js:9010 | Nenhum entregador bloqueado. | Nenhum Entregador Bloqueado. |
| Editar Loja | app.js:9019 | Nenhum entregador encontrado | Nenhum Entregador Encontrado |
| Editar Loja | app.js:9047 | Nova senha precisa ter no mínimo 6 caracteres. | Nova Senha Precisa Ter No Mínimo 6 Caracteres. |
| Editar Loja | app.js:9048 | Atualizando senha… | Atualizando Senha… |
| Editar Loja | app.js:9050 | ❌ Erro ao redefinir senha: ${resSenha.error} | ❌ Erro Ao Redefinir Senha: ${resSenha.error} |
| Editar Loja | app.js:9063 | CPF ou CNPJ inválido — confere os números. | CPF Ou CNPJ Inválido — Confere Os Números. |
| Editar Loja | app.js:9087 | Nome obrigatório. | Nome Obrigatório. |
| Editar Loja | app.js:9110 | Bloqueado na plataforma | Bloqueado Na Plataforma |
| Editar Loja | app.js:9113 | ✅ Loja atualizada! | ✅ Loja Atualizada! |
| Entrega Dedicada | app.js:10731 | Tem vaga disponível | Tem Vaga Disponível |
| Entrega Dedicada | app.js:10836 | Selecione a loja... | Selecione A Loja... |
| Entrega Dedicada | app.js:10850 | Nenhuma vaga cadastrada nesse dia ainda. | Nenhuma Vaga Cadastrada Nesse Dia Ainda. |
| Entrega Dedicada | app.js:10853 | ${_icone('plus',14)} Nova Vaga em ${dia}/${mes}/${ano} | ${_icone('plus',14)} Nova Vaga Em ${dia}/${mes}/${ano} |
| Entrega Dedicada | app.js:10854 | ${_icone('lock',16)} Dia já passou — não é possível criar vagas nesta data. | ${_icone('lock',16)} Dia Já Passou — Não É Possível Criar Vagas Nesta Data. |
| Entrega Dedicada | app.js:10861 | Valor (calculado automaticamente, por vaga) | Valor (Calculado Automaticamente, Por Vaga) |
| Entrega Dedicada | app.js:10884 | Preencha todos os campos e marque ao menos um período. | Preencha Todos Os Campos E Marque Ao Menos Um Período. |
| Entrega Dedicada | app.js:10897 | Vagas criadas! | Vagas Criadas! |
| Entrega Dedicada | app.js:10897 | Vaga criada! | Vaga Criada! |
| Entrega Dedicada | app.js:10900 | ❌ Erro ao criar vaga. | ❌ Erro Ao Criar Vaga. |
| Entrega Dedicada | app.js:10920 | Só no dia da vaga ou depois | Só No Dia Da Vaga Ou Depois |
| Entrega Dedicada | app.js:10931 | Ação indisponível | Ação Indisponível |
| Entrega Dedicada | app.js:10939 | ❌ Erro ao atualizar a vaga | ❌ Erro Ao Atualizar A Vaga |
| Entrega Dedicada | app.js:10940 | ⚠️ A vaga mudou | ⚠️ A Vaga Mudou |
| Entrega Dedicada | app.js:10940 | Atualizando a lista… | Atualizando A Lista… |
| Entrega Dedicada | app.js:10959 | CPF do Motoboy | CPF Do Motoboy |
| Entrega Dedicada | app.js:10970 | Digite um CPF. | Digite Um CPF. |
| Entrega Dedicada | app.js:10977 | Nenhum entregador encontrado com esse CPF. | Nenhum Entregador Encontrado Com Esse CPF. |
| Entrega Dedicada | app.js:10979 | Vagas fixas exigem motoboy de moto — alocação bloqueada. | Vagas Fixas Exigem Motoboy De Moto — Alocação Bloqueada. |
| Entrega Dedicada | app.js:10988 | ❌ Erro ao alocar | ❌ Erro Ao Alocar |
| Entrega Dedicada | app.js:10989 | ✅ Entregador alocado! | ✅ Entregador Alocado! |
| Entrega Dedicada | app.js:11009 | Descrição (opcional) | Descrição (Opcional) |
| Fatura (detalhe) | app.js:11895 | Carregando fatura... | Carregando Fatura... |
| Fatura (detalhe) | app.js:11957 | Emitida em: | Emitida Em: |
| Fatura (detalhe) | app.js:11969 | Total a Pagar | Total A Pagar |
| Fatura (detalhe) | app.js:11975 | Instruções de Pagamento | Instruções De Pagamento |
| Fatura (detalhe) | app.js:12006 | ${_icone('send',16,'btn-ico')}Enviar Comprovante no WhatsApp Financeiro | ${_icone('send',16,'btn-ico')}Enviar Comprovante No WhatsApp Financeiro |
| Financeiro da loja | app.js:10374 | Nenhuma loja associada ao seu usuário. | Nenhuma Loja Associada Ao Seu Usuário. |
| Financeiro da loja | app.js:10393 | Saldo do Crédito | Saldo Do Crédito |
| Financeiro da loja | app.js:10394 | ${_icone('wallet',18)} Extrato do Crédito | ${_icone('wallet',18)} Extrato Do Crédito |
| Financeiro da loja | app.js:10423 | Saldo do Crédito | Saldo Do Crédito |
| Financeiro da loja | app.js:10424 | Recarregue para continuar pedindo entregas. | Recarregue Para Continuar Pedindo Entregas. |
| Financeiro da loja | app.js:10424 | Cada entrega é descontada deste saldo. | Cada Entrega É Descontada Deste Saldo. |
| Financeiro da loja | app.js:10448 | Nenhuma movimentação ainda | Nenhuma Movimentação Ainda |
| Financeiro da loja | app.js:10449 | Esta loja ainda não tem lançamentos de crédito. | Esta Loja Ainda Não Tem Lançamentos De Crédito. |
| Financeiro da loja | app.js:10449 | Faça sua primeira recarga via Pix: o valor entra como crédito e cada entrega é descontada dele. | Faça Sua Primeira Recarga Via Pix: O Valor Entra Como Crédito E Cada Entrega É Descontada Dele. |
| Financeiro da loja | app.js:10452 | Nenhum lançamento nesse filtro | Nenhum Lançamento Nesse Filtro |
| Financeiro da loja | app.js:10452 | Ajuste o período ou o tipo para ver outros lançamentos. | Ajuste O Período Ou O Tipo Para Ver Outros Lançamentos. |
| Financeiro da loja | app.js:10462 | Débito de Entrega | Débito De Entrega |
| Gerar Cobranças | app.js:11633 | Nenhuma cobrança gerada ainda | Nenhuma Cobrança Gerada Ainda |
| Gerar Cobranças | app.js:11648 | Gerado em | Gerado Em |
| Gerar Cobranças | app.js:11685 | Total a Cobrar das Lojas | Total A Cobrar Das Lojas |
| Gerar Cobranças | app.js:11692 | Selecione o período | Selecione O Período |
| Gerar Cobranças | app.js:11719 | Nenhuma loja com pedidos finalizados no período | Nenhuma Loja Com Pedidos Finalizados No Período |
| Gerar Cobranças | app.js:11726 | Total a Cobrar | Total A Cobrar |
| Gerar Pagamentos | app.js:11175 | Total Pagamento aos Motoboys | Total Pagamento Aos Motoboys |
| Gerar Pagamentos | app.js:11184 | Selecione o período | Selecione O Período |
| Gerar Pagamentos | app.js:11235 | Nenhum entregador com saldo a pagar | Nenhum Entregador Com Saldo A Pagar |
| Gerar Pagamentos | app.js:11242 | Total a Pagar | Total A Pagar |
| Gerar Pagamentos | app.js:11263 | Nenhum saque pendente | Nenhum Saque Pendente |
| Gestor de Pedidos / Mapa | app.js:2277 | 🔔 Pedido pronto! | 🔔 Pedido Pronto! |
| Gestor de Pedidos / Mapa | app.js:2555 | Sem ret | Sem Ret |
| Gestor de Pedidos / Mapa | app.js:2584 | Selecione uma loja! | Selecione Uma Loja! |
| Gestor de Pedidos / Mapa | app.js:2585 | Endereço obrigatório | Endereço Obrigatório |
| Gestor de Pedidos / Mapa | app.js:2587 | Número obrigatório | Número Obrigatório |
| Gestor de Pedidos / Mapa | app.js:2593 | Nome obrigatório | Nome Obrigatório |
| Gestor de Pedidos / Mapa | app.js:2593 | Preencha o nome do cliente | Preencha O Nome Do Cliente |
| Gestor de Pedidos / Mapa | app.js:2599 | Telefone obrigatório | Telefone Obrigatório |
| Gestor de Pedidos / Mapa | app.js:2599 | Preencha o telefone do cliente | Preencha O Telefone Do Cliente |
| Gestor de Pedidos / Mapa | app.js:2605 | Complemento obrigatório | Complemento Obrigatório |
| Gestor de Pedidos / Mapa | app.js:2614 | Valor obrigatório | Valor Obrigatório |
| Gestor de Pedidos / Mapa | app.js:2614 | Preencha o valor do pedido que o motoboy deve cobrar do cliente (0 se já estiver pago) | Preencha O Valor Do Pedido Que O Motoboy Deve Cobrar Do Cliente (0 Se Já Estiver Pago) |
| Gestor de Pedidos / Mapa | app.js:2620 | Saldo insuficiente | Saldo Insuficiente |
| Gestor de Pedidos / Mapa | app.js:2620 | Recarregue seu saldo para criar entregas. | Recarregue Seu Saldo Para Criar Entregas. |
| Gestor de Pedidos / Mapa | app.js:2632 | Você acabou de criar uma entrega (#${_dupCr.numero}) para este mesmo endereço há poucos minutos.\nDeseja criar outra entrega mesmo assim? | Você Acabou De Criar Uma Entrega (#${_dupCr.numero}) Para Este Mesmo Endereço Há Poucos Minutos.\nDeseja Criar Outra Entrega Mesmo Assim? |
| Gestor de Pedidos / Mapa | app.js:2641 | Distância excedida | Distância Excedida |
| Gestor de Pedidos / Mapa | app.js:2641 | Para distâncias maiores que 32km, procure o Expansão responsável da região. | Para Distâncias Maiores Que 32km, Procure O Expansão Responsável Da Região. |
| Gestor de Pedidos / Mapa | app.js:2657 | ✅ Entrega criada! | ✅ Entrega Criada! |
| Gestor de Pedidos / Mapa | app.js:2673 | Sem ret | Sem Ret |
| Gestor de Pedidos / Mapa | app.js:2677 | Falha ao criar entrega | Falha Ao Criar Entrega |
| Gestor de Pedidos / Mapa | app.js:3096 | ⏳ Pagamento pendente | ⏳ Pagamento Pendente |
| Gestor de Pedidos / Mapa | app.js:3096 | Esse pedido ainda está aguardando pagamento — não pode ser marcado como pronto. | Esse Pedido Ainda Está Aguardando Pagamento — Não Pode Ser Marcado Como Pronto. |
| Gestor de Pedidos / Mapa | app.js:3107 | Desalocar o motoboy do pedido #${p?.numero\|\|pedidoId.substring(0,6)} e voltar a ficar disponível para novo aceite? | Desalocar O Motoboy Do Pedido #${p?.numero\|\|pedidoId.substring(0,6)} E Voltar A Ficar Disponível Para Novo Aceite? |
| Gestor de Pedidos / Mapa | app.js:3124 | Já estava pronto | Já Estava Pronto |
| Gestor de Pedidos / Mapa | app.js:3124 | Outra pessoa já marcou esse pedido como pronto. | Outra Pessoa Já Marcou Esse Pedido Como Pronto. |
| Gestor de Pedidos / Mapa | app.js:3142 | 🔓 Motoboy desalocado | 🔓 Motoboy Desalocado |
| Gestor de Pedidos / Mapa | app.js:3142 | 🔔 Pedido pronto! | 🔔 Pedido Pronto! |
| Gestor de Pedidos / Mapa | app.js:4228 | Buscar número, loja ou endereço... | Buscar Número, Loja Ou Endereço... |
| Gestor de Pedidos / Mapa | app.js:4232 | ${_icone('bike',16,'btn-ico')}Disparar Rota (0 pedidos) ++ | ${_icone('bike',16,'btn-ico')}Disparar Rota (0 Pedidos) ++ |
| Gestor de Pedidos / Mapa | app.js:4246 | Chat com o Suporte | Chat Com O Suporte |
| Gestor de Pedidos / Mapa | app.js:4247 | Mostrar Todos os Motoboys | Mostrar Todos Os Motoboys |
| Gestor de Pedidos / Mapa | app.js:4255 | Clique para ver os detalhes | Clique Para Ver Os Detalhes |
| Gestor de Pedidos / Mapa | app.js:4264 | Clique para ver a fatura | Clique Para Ver A Fatura |
| Gestor de Pedidos / Mapa | app.js:4273 | Selecione a loja... | Selecione A Loja... |
| Gestor de Pedidos / Mapa | app.js:4276 | Nome do Cliente | Nome Do Cliente |
| Gestor de Pedidos / Mapa | app.js:4282 | Sem ret | Sem Ret |
| Gestor de Pedidos / Mapa | app.js:4345 | Selecione a loja... | Selecione A Loja... |
| Gestor de Pedidos / Mapa | app.js:4394 | Taxa Dinâmica (cidade) | Taxa Dinâmica (Cidade) |
| Gestor de Pedidos / Mapa | app.js:13893 | Pedido não encontrado. | Pedido Não Encontrado. |
| Gestor de Pedidos / Mapa | app.js:13952 | Painel de Gestão | Painel De Gestão |
| Gestor de Pedidos / Mapa | app.js:13958 | Esqueci minha senha | Esqueci Minha Senha |
| Gestor de Pedidos / Mapa | app.js:13959 | Redefinir senha | Redefinir Senha |
| Gestor de Pedidos / Mapa | app.js:13959 | Entre em contato com o administrador para redefinir sua senha. | Entre Em Contato Com O Administrador Para Redefinir Sua Senha. |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:301 | Acessar o Sistema | Acessar O Sistema |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:302 | Bem vindo! Insira seu e-mail e senha. | Bem Vindo! Insira Seu E-mail E Senha. |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:303 | Email de Acesso | Email De Acesso |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:307 | Entre em contato com o administrador para redefinir sua senha. | Entre Em Contato Com O Administrador Para Redefinir Sua Senha. |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:309 | E-mail ou senha incorretos. | E-mail Ou Senha Incorretos. |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:310 | Ainda não é parceiro? Cadastre Sua Loja | Ainda Não É Parceiro? Cadastre Sua Loja |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:312 | Ao acessar o sistema com seu e-mail e senha, voce concorda com o nosso | Ao Acessar O Sistema Com Seu E-mail E Senha, Voce Concorda Com O Nosso |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:313 | Termo de Licença de Uso de Usuário Comerciante | Termo De Licença De Uso De Usuário Comerciante |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:329 | Preencha os dados abaixo. Depois de enviar, nosso time analisa o cadastro e libera o acesso. | Preencha Os Dados Abaixo. Depois De Enviar, Nosso Time Analisa O Cadastro E Libera O Acesso. |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:330 | Nome da Loja | Nome Da Loja |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:334 | Telefone da Loja | Telefone Da Loja |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:337 | Nome do Responsável | Nome Do Responsável |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:338 | CPF ou CNPJ | CPF Ou CNPJ |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:388 | Integração com Cardápio Web | Integração Com Cardápio Web |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:389 | Essa integração está em preparação. Em breve, lojas parceiras do Cardápio Web poderão conectar sua conta aqui para que os pedidos sejam despachados automaticamente pela Let's Go Delivery. | Essa Integração Está Em Preparação. Em Breve, Lojas Parceiras Do Cardápio Web Poderão Conectar Sua Conta Aqui Para Que Os Pedidos Sejam Despachados Automaticamente Pela Let's Go Delivery. |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:414 | Mapa ao Vivo | Mapa Ao Vivo |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:415 | Mapa ao Vivo | Mapa Ao Vivo |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:417 | Saldo da Carteira | Saldo Da Carteira |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:428 | Horário de Brasília — Conferência Visual | Horário De Brasília — Conferência Visual |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:446 | Nome do Cliente | Nome Do Cliente |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:449 | Endereço de Entrega | Endereço De Entrega |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:458 | Itens, observações... | Itens, Observações... |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:477 | Nome da Loja | Nome Da Loja |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:557 | Tipo de Cliente | Tipo De Cliente |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:558 | Nome do Responsável | Nome Do Responsável |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:561 | WhatsApp da Loja | WhatsApp Da Loja |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:565 | E-mail de Acesso | E-mail De Acesso |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:566 | Senha de Acesso | Senha De Acesso |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:566 | Senha para Login | Senha Para Login |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:573 | Tabela de Cobrança | Tabela De Cobrança |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:574 | Tabela de Pagamento (Motoboy) | Tabela De Pagamento (Motoboy) |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:577 | Tipo de Cobrança | Tipo De Cobrança |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:580 | Ativar Roterizador para Esta Loja | Ativar Roterizador Para Esta Loja |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:582 | Raio de Agrupamento (km) | Raio De Agrupamento (km) |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:583 | Máximo de Pedidos por Rota | Máximo De Pedidos Por Rota |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:585 | Tempo de espera para agrupar (segundos) | Tempo De Espera Para Agrupar (Segundos) |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:615 | Senha de Acesso | Senha De Acesso |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:619 | Selecione a loja | Selecione A Loja |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:635 | 💰 Tabela de Preço | 💰 Tabela De Preço |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:659 | Preencha e-mail e senha. | Preencha E-mail E Senha. |
| HTML do Hostinger (login e modais fixos) | hostinger/index.html:663 | E-mail ou senha incorretos. | E-mail Ou Senha Incorretos. |
| Início da loja | app.js:13299 | Nenhuma loja associada ao seu usuário. | Nenhuma Loja Associada Ao Seu Usuário. |
| Início da loja | app.js:13319 | Conteúdos para Você | Conteúdos Para Você |
| Início da loja | app.js:13329 | Comece por Aqui | Comece Por Aqui |
| Início da loja | app.js:13331 | Acesse o Gestor de Pedidos | Acesse O Gestor De Pedidos |
| Início da loja | app.js:13331 | Acompanhe seus pedidos em tempo real no mapa, com o status de cada entrega. | Acompanhe Seus Pedidos Em Tempo Real No Mapa, Com O Status De Cada Entrega. |
| Início da loja | app.js:13331 | Acessar Gestor de Pedidos | Acessar Gestor De Pedidos |
| Início da loja | app.js:13332 | Crie uma Entrega | Crie Uma Entrega |
| Início da loja | app.js:13332 | Chame um entregador para uma nova entrega em poucos cliques. | Chame Um Entregador Para Uma Nova Entrega Em Poucos Cliques. |
| Início da loja | app.js:13334 | Resumo de Hoje | Resumo De Hoje |
| Início da loja | app.js:13352 | Nenhum pedido hoje ainda | Nenhum Pedido Hoje Ainda |
| Início da loja | app.js:13352 | Assim que os pedidos de hoje chegarem, o resumo aparece aqui. | Assim Que Os Pedidos De Hoje Chegarem, O Resumo Aparece Aqui. |
| Início da loja (carrossel) | app.js:3553 | Aguardando aceite | Aguardando Aceite |
| Início da loja (carrossel) | app.js:7950 | Bom dia | Bom Dia |
| Início da loja (carrossel) | app.js:7951 | Boa tarde | Boa Tarde |
| Início da loja (carrossel) | app.js:7952 | Boa noite | Boa Noite |
| Início da loja (carrossel) | app.js:13193 | Ver planos | Ver Planos |
| Início da loja (carrossel) | app.js:13193 | Let's Go Envios: entregas para os seus pedidos próprios | Let's Go Envios: Entregas Para Os Seus Pedidos Próprios |
| Início da loja (carrossel) | app.js:13193 | Nossos planos | Nossos Planos |
| Início da loja (carrossel) | app.js:13193 | Use nossos entregadores nos pedidos que você mesmo vende: <br class="li-br-desk">WhatsApp, telefone, balcão e site próprio. | Use Nossos Entregadores Nos Pedidos Que Você Mesmo Vende: <br class="li-br-desk">WhatsApp, Telefone, Balcão E Site Próprio. |
| Início da loja (carrossel) | app.js:13197 | Quero o Turbo | Quero O Turbo |
| Início da loja (carrossel) | app.js:13197 | Let's Go Turbo: seu produto na mão do cliente em até 10 minutos | Let's Go Turbo: Seu Produto Na Mão Do Cliente Em Até 10 Minutos |
| Início da loja (carrossel) | app.js:13197 | Tem produto de marca própria? Deixe seu estoque na nossa base Turbo Fresh Ribeirão. Pedido aprovado, expedição em 1 minuto e entrega em até 10 minutos na região de Ribeirão Preto. A partir de R$ 49,90/mês + valor por entrega. | Tem Produto De Marca Própria? Deixe Seu Estoque Na Nossa Base Turbo Fresh Ribeirão. Pedido Aprovado, Expedição Em 1 Minuto E Entrega Em Até 10 Minutos Na Região De Ribeirão Preto. A Partir De R$ 49,90/mês + Valor Por Entrega. |
| Início da loja (carrossel) | app.js:13197 | Dúvidas sobre cadastro e aprovação? (11) 99170-2772 | Dúvidas Sobre Cadastro E Aprovação? (11) 99170-2772 |
| Início da loja (carrossel) | app.js:13198 | Entrega Dedicada: garanta entregadores fixos na sua loja | Entrega Dedicada: Garanta Entregadores Fixos Na Sua Loja |
| Início da loja (carrossel) | app.js:13198 | Reserve entregadores exclusivos para os horários de maior movimento e tenha mais previsibilidade nas suas entregas. | Reserve Entregadores Exclusivos Para Os Horários De Maior Movimento E Tenha Mais Previsibilidade Nas Suas Entregas. |
| Início da loja (carrossel) | app.js:13203 | Você já conhece as vantagens do crédito pré-pago? | Você Já Conhece As Vantagens Do Crédito Pré-Pago? |
| Início da loja (carrossel) | app.js:13204 | Recarregar agora | Recarregar Agora |
| Início da loja (carrossel) | app.js:13204 | Recarregue seu saldo nos 7 primeiros dias úteis do mês e ganhe bônus de até ${_rcgBonusMaxPct(_rcgPacotes(null))}% em crédito. Quanto maior a recarga, maior o bônus. | Recarregue Seu Saldo Nos 7 Primeiros Dias Úteis Do Mês E Ganhe Bônus De Até ${_rcgBonusMaxPct(_rcgPacotes(null))}% Em Crédito. Quanto Maior A Recarga, Maior O Bônus. |
| Início da loja (carrossel) | app.js:13205 | Acompanhe seus clientes | Acompanhe Seus Clientes |
| Início da loja (carrossel) | app.js:13205 | Ver meus clientes | Ver Meus Clientes |
| Início da loja (carrossel) | app.js:13205 | Veja quantos clientes você atendeu, quantos são novos e quem pede com mais frequência. | Veja Quantos Clientes Você Atendeu, Quantos São Novos E Quem Pede Com Mais Frequência. |
| Início da loja (carrossel) | app.js:13206 | Acompanhe seu desempenho | Acompanhe Seu Desempenho |
| Início da loja (carrossel) | app.js:13206 | Ver desempenho | Ver Desempenho |
| Início da loja (carrossel) | app.js:13206 | Acompanhe os números da sua loja e a evolução dos seus pedidos ao longo do tempo. | Acompanhe Os Números Da Sua Loja E A Evolução Dos Seus Pedidos Ao Longo Do Tempo. |
| Lojas | app.js:8932 | Nenhuma loja | Nenhuma Loja |
| Lojas | app.js:8932 | Telefone ainda é placeholder de importação — edite a loja pra completar | Telefone Ainda É Placeholder De Importação — Edite A Loja Pra Completar |
| Lojas | app.js:8932 | Financeiro da Loja | Financeiro Da Loja |
| Menu lateral | app.js:154 | Cobrança e Pagamento | Cobrança E Pagamento |
| Menu lateral | app.js:171 | Gestor de Pedidos | Gestor De Pedidos |
| Menu lateral | app.js:173 | Perfil da Loja | Perfil Da Loja |
| Menu lateral | app.js:177 | Formas de Pagamento | Formas De Pagamento |
| Menu lateral | app.js:186 | Mapa ao Vivo | Mapa Ao Vivo |
| Menu lateral | app.js:187 | Mapa ao Vivo | Mapa Ao Vivo |
| Menu lateral | app.js:188 | Mapa ao Vivo | Mapa Ao Vivo |
| Menu lateral | app.js:190 | Mapa ao Vivo | Mapa Ao Vivo |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2351 | Digite o nome da loja... | Digite O Nome Da Loja... |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2357 | Plataforma de Origem | Plataforma De Origem |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2357 | iFood (loja não integrada) | iFood (Loja Não Integrada) |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2360 | Nome do Cliente | Nome Do Cliente |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2364 | Endereço de Entrega | Endereço De Entrega |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2367 | Apto, Bloco, Ponto de Referência | Apto, Bloco, Ponto De Referência |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2379 | Sem retorno | Sem Retorno |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2382 | Itens do pedido... | Itens Do Pedido... |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2386 | 📦 Coleta em Outro Endereço | 📦 Coleta Em Outro Endereço |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2390 | Endereço de Coleta | Endereço De Coleta |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2394 | Contato na Coleta | Contato Na Coleta |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2394 | Nome do Contato | Nome Do Contato |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2395 | Telefone da Coleta | Telefone Da Coleta |
| Modais do topo (Novo Pedido, Nova Loja, etc.) | app.js:2404 | Data e Hora | Data E Hora |
| Notificações (disparo) | app.js:12312 | Os 2 disparos automáticos rodam sozinhos a cada 3 dias (72h), às 9h. O texto salvo aqui é o | Os 2 Disparos Automáticos Rodam Sozinhos A Cada 3 Dias (72h), Às 9h. O Texto Salvo Aqui É O |
| Notificações (disparo) | app.js:12312 | usado pelo disparo automático E pelo botão "Enviar agora pra todos" — editar aqui muda os dois de uma vez só. | Usado Pelo Disparo Automático E Pelo Botão "Enviar Agora Pra Todos" — Editar Aqui Muda Os Dois De Uma Vez Só. |
| Notificações (disparo) | app.js:12316 | Pede pro entregador avaliar o app na Play Store. Texto neutro de propósito — políticas da Play Store proíbem pedir uma nota específica. | Pede Pro Entregador Avaliar O App Na Play Store. Texto Neutro De Propósito — Políticas Da Play Store Proíbem Pedir Uma Nota Específica. |
| Notificações (disparo) | app.js:12323 | ${_icone('megaphone',16,'btn-ico')}Enviar Agora pra Todos | ${_icone('megaphone',16,'btn-ico')}Enviar Agora Pra Todos |
| Notificações (disparo) | app.js:12335 | ${_icone('megaphone',16,'btn-ico')}Enviar Agora pra Todos | ${_icone('megaphone',16,'btn-ico')}Enviar Agora Pra Todos |
| Notificações (disparo) | app.js:12340 | 📅 Lembretes por Dia da Semana | 📅 Lembretes Por Dia Da Semana |
| Notificações (disparo) | app.js:12341 | 14 Disparos automáticos (7 dias × 2 horários fixos, 09:09 e 18:18 brasília) — cada card é independente, com seu próprio texto. Card com título/mensagem vazio simplesmente não dispara nesse dia. Sem botão de "enviar a todos" aqui — são só automáticos, use "Testar" pra conferir o texto antes. | 14 Disparos Automáticos (7 Dias × 2 Horários Fixos, 09:09 E 18:18 Brasília) — Cada Card É Independente, Com Seu Próprio Texto. Card Com Título/Mensagem Vazio Simplesmente Não Dispara Nesse Dia. Sem Botão De "Enviar A Todos" Aqui — São Só Automáticos, Use "Testar" Pra Conferir O Texto Antes. |
| Notificações (disparo) | app.js:12436 | Preencha título e mensagem | Preencha Título E Mensagem |
| Notificações (disparo) | app.js:12440 | ✅ Salvo! Já vale pro próximo disparo automático e pro botão "Enviar agora". | ✅ Salvo! Já Vale Pro Próximo Disparo Automático E Pro Botão "Enviar Agora". |
| Notificações (disparo) | app.js:12443 | ❌ Erro ao Salvar | ❌ Erro Ao Salvar |
| Notificações (disparo) | app.js:12464 | ⏳ Enviando teste... | ⏳ Enviando Teste... |
| Notificações (disparo) | app.js:12468 | ✅ Teste enviado às ${formatarHora(new Date().toISOString())} | ✅ Teste Enviado Às ${formatarHora(new Date().toISOString())} |
| Notificações (disparo) | app.js:12470 | ❌ Não enviou (${(res&&res.error)\|\|'sem token FCM salvo?'}) | ❌ Não Enviou (${(res&&res.error)\|\|'sem token FCM salvo?'}) |
| Notificações (disparo) | app.js:12474 | ❌ Erro ao chamar a function | ❌ Erro Ao Chamar A Function |
| Notificações (disparo) | app.js:12481 | Confirma o envio dessa notificação pra TODOS os entregadores aprovados agora? | Confirma O Envio Dessa Notificação Pra TODOS Os Entregadores Aprovados Agora? |
| Notificações (disparo) | app.js:12482 | ⏳ Enviando pra todos... | ⏳ Enviando Pra Todos... |
| Notificações (disparo) | app.js:12486 | ✅ Enviado pra ${(res&&res.sent)\|\|0} entregadores às ${hora} | ✅ Enviado Pra ${(res&&res.sent)\|\|0} Entregadores Às ${hora} |
| Notificações (disparo) | app.js:12489 | ❌ Erro ao Enviar | ❌ Erro Ao Enviar |
| Novo Entregador | app.js:6612 | João da Silva | João Da Silva |
| Novo Pedido | app.js:2715 | ❌ Selecione uma loja primeiro | ❌ Selecione Uma Loja Primeiro |
| Novo Pedido | app.js:2718 | 📍 Calculando distância... | 📍 Calculando Distância... |
| Novo Pedido | app.js:2744 | distKm | DistKm |
| Novo Pedido | app.js:2751 | ✅ ${distKm.toFixed(2)} km (${origemUsada}) → taxa: R$ ${_totalDisplay.toFixed(2)} | ✅ ${distKm.toFixed(2)} km (${origemUsada}) → Taxa: R$ ${_totalDisplay.toFixed(2)} |
| Novo Pedido | app.js:2771 | Chegou no Local | Chegou No Local |
| Novo Pedido | app.js:2773 | Chegou no Destino | Chegou No Destino |
| Novo Pedido | app.js:5060 | Sem retorno | Sem Retorno |
| Novo Pedido | app.js:7228 | Digite o nome da loja... | Digite O Nome Da Loja... |
| Novo Pedido | app.js:7230 | Plataforma de Origem | Plataforma De Origem |
| Novo Pedido | app.js:7230 | iFood (loja não integrada) | iFood (Loja Não Integrada) |
| Novo Pedido | app.js:7230 | Endereço de Entrega | Endereço De Entrega |
| Novo Pedido | app.js:7230 | Sem retorno | Sem Retorno |
| Novo Pedido | app.js:7230 | Apto, Bloco, Ponto de Referência | Apto, Bloco, Ponto De Referência |
| Novo Pedido | app.js:7230 | Itens do pedido... | Itens Do Pedido... |
| Pedidos | app.js:2825 | Pedido já tem entregador | Pedido Já Tem Entregador |
| Pedidos | app.js:2825 | Remova o motoboy alocado antes de marcar como pronto de novo. | Remova O Motoboy Alocado Antes De Marcar Como Pronto De Novo. |
| Pedidos | app.js:2858 | ❌ Pedido cancelado | ❌ Pedido Cancelado |
| Pedidos | app.js:2865 | Pedido já tem entregador | Pedido Já Tem Entregador |
| Pedidos | app.js:2865 | Outra pessoa já alocou/alterou esse pedido. | Outra Pessoa Já Alocou/Alterou Esse Pedido. |
| Pedidos | app.js:2869 | 🔔 Pedido pronto! | 🔔 Pedido Pronto! |
| Pedidos | app.js:2869 | Motoboys serão notificados | Motoboys Serão Notificados |
| Pedidos | app.js:4434 | ✓ Todos os Pedidos Carregados | ✓ Todos Os Pedidos Carregados |
| Pedidos | app.js:4719 | Nenhum pedido | Nenhum Pedido |
| Pedidos | app.js:4724 | Chegou no Local | Chegou No Local |
| Pedidos | app.js:4726 | Chegou no Destino | Chegou No Destino |
| Pedidos | app.js:4800 | 🏪 Retirada na Loja | 🏪 Retirada Na Loja |
| Pedidos | app.js:4822 | 🔒 Aguardando entregador | 🔒 Aguardando Entregador |
| Pedidos | app.js:4844 | Pedido da Integração iFood | Pedido Da Integração iFood |
| Pedidos | app.js:4855 | Marcar como pronto (desaloca o entregador, se houver) | Marcar Como Pronto (Desaloca O Entregador, Se Houver) |
| Pedidos | app.js:4869 | Saída Até ${horaSaidaAte} para Evitar Atraso | Saída Até ${horaSaidaAte} Para Evitar Atraso |
| Pedidos | app.js:7418 | Nº pedido... | Nº Pedido... |
| Pedidos | app.js:7423 | Todos os Pedidos | Todos Os Pedidos |
| Pedidos | app.js:7431 | Contas a Pagar | Contas A Pagar |
| Pedidos | app.js:7438 | ⏱️ SLA de entrega (Aceito → chegada no cliente) | ⏱️ SLA De Entrega (Aceito → Chegada No Cliente) |
| Pedidos | app.js:7439 | 📏 Distribuição de Distância (KM) | 📏 Distribuição De Distância (KM) |
| Pedidos | app.js:7440 | Ver Linha do Tempo | Ver Linha Do Tempo |
| Pedidos | app.js:7572 | Mais de 40 min | Mais De 40 min |
| Pedidos | app.js:7587 | Nenhum pedido finalizado com dados de SLA no período | Nenhum Pedido Finalizado Com Dados De SLA No Período |
| Pedidos | app.js:7597 | Nenhum pedido finalizado com KM no período | Nenhum Pedido Finalizado Com KM No Período |
| Pedidos | app.js:7616 | Clique para alterar o status | Clique Para Alterar O Status |
| Pedidos | app.js:7616 | Não é possível alterar pedidos de semanas anteriores | Não É Possível Alterar Pedidos De Semanas Anteriores |
| Pedidos | app.js:7626 | Lançamento manual, não é pedido | Lançamento Manual, Não É Pedido |
| Pedidos | app.js:7628 | Nenhum pedido encontrado | Nenhum Pedido Encontrado |
| Pedidos | app.js:7646 | Chegou no Estabelecimento | Chegou No Estabelecimento |
| Pedidos | app.js:7647 | Saiu em Rota | Saiu Em Rota |
| Pedidos (comanda) | app.js:12054 | 🏪 Retirada na Loja | 🏪 Retirada Na Loja |
| Pedidos (comanda) | app.js:12055 | Código de Coleta (iFOOD) | Código De Coleta (iFood) |
| Pedidos (comanda) | app.js:12064 | Troco para: | Troco Para: |
| Pedidos (código iFood) | app.js:3648 | Código Informado pelo Motoboy | Código Informado Pelo Motoboy |
| Pedidos (detalhes) | app.js:3702 | Previsão de Entrega | Previsão De Entrega |
| Pedidos (detalhes) | app.js:3709 | 📦 Itens do Pedido | 📦 Itens Do Pedido |
| Pedidos (detalhes) | app.js:3743 | 🔗 Copiar Link de Rastreio | 🔗 Copiar Link De Rastreio |
| Pedidos (detalhes) | app.js:3743 | ✅ Link copiado! | ✅ Link Copiado! |
| Pedidos (editar pedido) | app.js:5006 | Endereço de Entrega | Endereço De Entrega |
| Pedidos (editar pedido) | app.js:5016 | Sem retorno | Sem Retorno |
| Pedidos (editar pedido) | app.js:5032 | Endereço de Coleta | Endereço De Coleta |
| Pedidos (editar pedido) | app.js:5034 | Contato na Coleta | Contato Na Coleta |
| Pedidos (editar pedido) | app.js:5035 | Telefone da Coleta | Telefone Da Coleta |
| Pedidos (editar pedido) | app.js:5045 | Data e Hora | Data E Hora |
| Pedidos (editar pedido) | app.js:5070 | Sem retorno | Sem Retorno |
| Pedidos (linha do tempo) | app.js:7658 | Pedido não encontrado na lista atual | Pedido Não Encontrado Na Lista Atual |
| Pedidos (linha do tempo) | app.js:7684 | ⏱️ ${m.duracao} Depois do Marco Anterior | ⏱️ ${m.duracao} Depois Do Marco Anterior |
| Pedidos (linha do tempo) | app.js:7689 | ${_icone('history',18)} Linha do Tempo — #${p.numero\|\|p.id.substring(0,6)} | ${_icone('history',18)} Linha Do Tempo — #${p.numero\|\|p.id.substring(0,6)} |
| Pedidos (linha do tempo) | app.js:7692 | ⚠️ Um ou mais marcos não foram registrados pra esse pedido (comum em pedidos antigos — anteriores ao marco existir no sistema —, cancelados no meio do fluxo, ou com status alterado manualmente pulando etapas). | ⚠️ Um Ou Mais Marcos Não Foram Registrados Pra Esse Pedido (Comum Em Pedidos Antigos — Anteriores Ao Marco Existir No Sistema —, Cancelados No Meio Do Fluxo, Ou Com Status Alterado Manualmente Pulando Etapas). |
| Pedidos (linha do tempo) | app.js:7693 | Rota real (GPS) ainda não é registrada pelo sistema — só o horário de cada marco acima. | Rota Real (GPS) Ainda Não É Registrada Pelo Sistema — Só O Horário De Cada Marco Acima. |
| Pedidos (troca de endereço iFood) | app.js:3572 | 📍 Cliente Pediu Troca de Endereço | 📍 Cliente Pediu Troca De Endereço |
| Preço Dinâmico | app.js:6692 | Global (Todas as Cidades) | Global (Todas As Cidades) |
| Preço Dinâmico | app.js:6700 | Selecionar cidade... | Selecionar Cidade... |
| Preço Dinâmico | app.js:7000 | ✅ Preço dinâmico salvo! | ✅ Preço Dinâmico Salvo! |
| Preço Dinâmico | app.js:7003 | ❌ Erro ao Salvar | ❌ Erro Ao Salvar |
| Preço Dinâmico | app.js:7041 | Cobrança da Loja | Cobrança Da Loja |
| Preço Dinâmico | app.js:7041 | Pagamento do Entregador | Pagamento Do Entregador |
| Preço Dinâmico | app.js:7074 | Nenhum encontrado | Nenhum Encontrado |
| Preço Dinâmico | app.js:7168 | ✅ Preço dinâmico ${cidade} salvo! | ✅ Preço Dinâmico ${cidade} Salvo! |
| Preço Dinâmico | app.js:7171 | ❌ Erro ao Salvar | ❌ Erro Ao Salvar |
| Página de rastreio (cliente final) | app.js:13794 | Previsão de Entrega | Previsão De Entrega |
| Página de rastreio (cliente final) | app.js:13823 | Código pra Entrega | Código Pra Entrega |
| Página de rastreio (cliente final) | app.js:13828 | Precisa de suporte com sua entrega? | Precisa De Suporte Com Sua Entrega? |
| Página de rastreio (cliente final) | app.js:13828 | Qualquer dúvida, nossa equipe está À disposição. | Qualquer Dúvida, Nossa Equipe Está À Disposição. |
| Página de rastreio (cliente final) | app.js:13870 | Pedido entregue! | Pedido Entregue! |
| Página de rastreio (cliente final) | app.js:13873 | Avalie nosso app na Play Store | Avalie Nosso App Na Play Store |
| Página de rastreio (cliente final) | app.js:13875 | ⭐ Avaliar na Play Store | ⭐ Avaliar Na Play Store |
| Ranking → Clãs | app.js:10644 | Nenhum disponível (todos já estão em outro clã) | Nenhum Disponível (Todos Já Estão Em Outro Clã) |
| Recarga de saldo (modal) | app.js:3411 | Depois da primeira recarga, todos os pacotes ficam disponíveis. | Depois Da Primeira Recarga, Todos Os Pacotes Ficam Disponíveis. |
| Recarga de saldo (modal) | app.js:3411 | O primeiro depósito é de no mínimo ${_rcgFmtCurto(i.minimo_primeira_recarga\|\|_RCG_MINIMO_PRIMEIRA)}. | O Primeiro Depósito É De No Mínimo ${_rcgFmtCurto(i.minimo_primeira_recarga\|\|_RCG_MINIMO_PRIMEIRA)}. |
| Recarga de saldo (modal) | app.js:3412 | Bônus de até ${maxPct}% ativo. | Bônus De Até ${maxPct}% Ativo. |
| Recarga de saldo (modal) | app.js:3412 | Bônus válido até ${_rcgDM(j.fim)}. | Bônus Válido Até ${_rcgDM(j.fim)}. |
| Recarga de saldo (modal) | app.js:3413 | Bônus nos 7 primeiros dias úteis de ${_rcgMes(j.proximo_inicio)}, a partir de ${_rcgDM(j.proximo_inicio)}. | Bônus Nos 7 Primeiros Dias Úteis De ${_rcgMes(j.proximo_inicio)}, A Partir De ${_rcgDM(j.proximo_inicio)}. |
| Recarga de saldo (modal) | app.js:3424 | Recomendado · Ideal para Começar | Recomendado · Ideal Para Começar |
| Recarga de saldo (modal) | app.js:3426 | ${_icone('badge-percent',12)} +${p.pct}% de Bônus | ${_icone('badge-percent',12)} +${p.pct}% De Bônus |
| Recarga de saldo (modal) | app.js:3428 | Você recebe | Você Recebe |
| Recarga de saldo (modal) | app.js:3435 | Valor da Recarga | Valor Da Recarga |
| Recarga de saldo (modal) | app.js:3456 | Valor abaixo do mínimo | Valor Abaixo Do Mínimo |
| Recarga de saldo (modal) | app.js:3456 | O primeiro depósito é de no mínimo R$ 300. | O Primeiro Depósito É De No Mínimo R$ 300. |
| Recarga de saldo (modal) | app.js:3467 | ${_icone('arrow-left',16)}Voltar aos Pacotes | ${_icone('arrow-left',16)}Voltar Aos Pacotes |
| Recarga de saldo (modal) | app.js:3469 | QR indisponível no momento — use o código copia e cola. | QR Indisponível No Momento — Use O Código Copia E Cola. |
| Recarga de saldo (modal) | app.js:3471 | Valor do Pix | Valor Do Pix |
| Recarga de saldo (modal) | app.js:3473 | Você recebe | Você Recebe |
| Recarga de saldo (modal) | app.js:3476 | ${_icone('copy',18)}Copiar código Pix (copia e cola) | ${_icone('copy',18)}Copiar Código Pix (Copia E Cola) |
| Recarga de saldo (modal) | app.js:3477 | ${_icone('message-circle',18)}Enviar Comprovante pelo WhatsApp | ${_icone('message-circle',18)}Enviar Comprovante Pelo WhatsApp |
| Relatórios | app.js:9718 | Todas as Lojas | Todas As Lojas |
| Relatórios | app.js:9721 | Pedidos por Status | Pedidos Por Status |
| Saque Rápido | app.js:11433 | Pago no Período | Pago No Período |
| Saque Rápido | app.js:11434 | Lucro no Período | Lucro No Período |
| Saque Rápido | app.js:11442 | Saques Rápidos Pendentes de Aprovação | Saques Rápidos Pendentes De Aprovação |
| Saque Rápido | app.js:11499 | Nenhum saque rápido pendente | Nenhum Saque Rápido Pendente |
| Tabelas de Preço | app.js:13064 | Nenhuma tabela. Clique ➕ para criar. | Nenhuma Tabela. Clique ➕ Para Criar. |
| Tabelas de Preço | app.js:13077 | Sem retorno | Sem Retorno |
| Tabelas de Preço | app.js:13077 | Taxa KM adicional: | Taxa KM Adicional: |
| Tabelas de Preço | app.js:13102 | Km de | Km De |
| Tabelas de Preço | app.js:13102 | Taxa por KM adicional (acima do último range) | Taxa Por KM Adicional (Acima Do Último Range) |
| Tabelas de Preço | app.js:13102 | /Km percorrido além do último range | /Km Percorrido Além Do Último Range |
| Tabelas de Preço | app.js:13123 | Km de | Km De |
| Visão Executiva | app.js:7838 | Sem dados no período | Sem Dados No Período |
| Visão Executiva | app.js:7881 | Faturamento (eixo esquerdo) | Faturamento (Eixo Esquerdo) |
| Visão Executiva | app.js:7882 | Pedidos Finalizados (eixo direito) | Pedidos Finalizados (Eixo Direito) |
| Visão Executiva | app.js:7883 | · Passe o mouse no gráfico pra ver o valor exato | · Passe O Mouse No Gráfico Pra Ver O Valor Exato |
| Visão Executiva | app.js:8352 | Aqui está o resumo da performance da Let's Go Delivery hoje. | Aqui Está O Resumo Da Performance Da Let's Go Delivery Hoje. |
| Visão Executiva | app.js:8359 | Hoje é dia de ${_dataComemorativaHoje()} | Hoje É Dia De ${_dataComemorativaHoje()} |
| Visão Executiva | app.js:8365 | Em breve | Em Breve |
| Visão Executiva | app.js:8365 | Edição de perfil ainda não está disponível. | Edição De Perfil Ainda Não Está Disponível. |
| Visão Executiva | app.js:8375 | 📈 Crescimento da Empresa | 📈 Crescimento Da Empresa |
| Visão Executiva | app.js:8388 | 🎯 Hoje, o que merece sua atenção | 🎯 Hoje, O Que Merece Sua Atenção |
| Visão Executiva | app.js:8397 | Juntos, vamos mais longe. · #CadaKmUmSonho | Juntos, Vamos Mais Longe. · #CadaKmUmSonho |
| Visão Executiva | app.js:8438 | aguardando aprovação de cadastro | Aguardando Aprovação De Cadastro |
| WhatsApp Financeiro | app.js:12144 | ⚠️ API não configurada | ⚠️ API Não Configurada |
| WhatsApp Financeiro | app.js:12144 | Vá em Disparo WhatsApp → Configuração API | Vá Em Disparo WhatsApp → Configuração API |
| WhatsApp Financeiro | app.js:12149 | ℹ️ Sem lojas com WhatsApp financeiro | ℹ️ Sem Lojas Com WhatsApp Financeiro |
| WhatsApp Financeiro | app.js:12150 | Disparar mensagem financeira para ${alvo.length} loja(s)? | Disparar Mensagem Financeira Para ${alvo.length} Loja(s)? |
| WhatsApp Financeiro | app.js:12158 | 📲 Financeiro enviado! | 📲 Financeiro Enviado! |
| WhatsApp Financeiro | app.js:12246 | Configure o chip para disparo automático de mensagens WhatsApp. | Configure O Chip Para Disparo Automático De Mensagens WhatsApp. |
| WhatsApp Financeiro | app.js:12247 | URL da API | URL Da API |
| WhatsApp Financeiro | app.js:12260 | 🛵 Mensagem em Rota | 🛵 Mensagem Em Rota |
| WhatsApp Financeiro | app.js:12261 | Enviada automaticamente ao número do cliente quando o motoboy clicar em | Enviada Automaticamente Ao Número Do Cliente Quando O Motoboy Clicar Em |
| WhatsApp Financeiro | app.js:12261 | preenchido no pedido. | Preenchido No Pedido. |
| WhatsApp Financeiro | app.js:12263 | nº pedido | Nº Pedido |
| WhatsApp Financeiro | app.js:12275 | segunda-feira às 08:01 | Segunda-Feira Às 08:01 |
| WhatsApp Financeiro | app.js:12275 | ao campo | Ao Campo |
| WhatsApp Financeiro | app.js:12275 | de cada loja ativa. O painel precisa estar aberto neste horário. | De Cada Loja Ativa. O Painel Precisa Estar Aberto Neste Horário. |
| WhatsApp Financeiro | app.js:12277 | nome da loja | Nome Da Loja |
| _abrirChatAdmin | app.js:735 | Selecione uma conversa | Selecione Uma Conversa |
| _abrirChatLoja | app.js:704 | ${_icone('message-circle',18)} Chat com o Suporte | ${_icone('message-circle',18)} Chat Com O Suporte |
| _abrirChatLoja | app.js:707 | Digite sua mensagem... | Digite Sua Mensagem... |
| _abrirConversaAdmin | app.js:805 | Digite sua mensagem... | Digite Sua Mensagem... |
| _abrirDropdownCadastroLoja | app.js:6034 | ❌ Reprovado (com motivo) | ❌ Reprovado (Com Motivo) |
| _agruparPorProximidade | app.js:14070 | calcularDistancia(x.latitude,x.longitude,pedidos[j].latitude,pedidos[j].longitude) | CalcularDistancia(x.latitude,x.longitude,pedidos[j].latitude,pedidos[j].longitude) |
| _aprovarCobrancaUnica | app.js:11877 | Não foi possível aprovar | Não Foi Possível Aprovar |
| _aprovarCobrancaUnica | app.js:11879 | ✅ Cobrança aprovada! | ✅ Cobrança Aprovada! |
| _aprovarCobrancasSelecionadas | app.js:11862 | Selecione ao menos uma cobrança | Selecione Ao Menos Uma Cobrança |
| _aprovarCobrancasSelecionadas | app.js:11869 | ✅ ${ok} cobrança(s) aprovada(s)! | ✅ ${ok} Cobrança(s) Aprovada(s)! |
| _aprovarDocumento | app.js:6450 | ❌ Erro ao aprovar documento | ❌ Erro Ao Aprovar Documento |
| _aprovarDocumento | app.js:6452 | ✅ Documento aprovado | ✅ Documento Aprovado |
| _aprovarEntregador | app.js:6291 | ❌ Erro ao aprovar | ❌ Erro Ao Aprovar |
| _aprovarEntregador | app.js:6292 | ✅ Entregador aprovado! | ✅ Entregador Aprovado! |
| _aprovarSaquesRapidosSelecionados | app.js:11532 | Selecione ao menos um saque | Selecione Ao Menos Um Saque |
| _aprovarSaquesRapidosSelecionados | app.js:11553 | ✅ ${ok} saque(s) rápido(s) aprovado(s)! | ✅ ${ok} Saque(s) Rápido(s) Aprovado(s)! |
| _aprovarSaquesSelecionados | app.js:11377 | Selecione ao menos um saque | Selecione Ao Menos Um Saque |
| _aprovarSaquesSelecionados | app.js:11396 | ✅ ${ok} saque(s) aprovado(s)! | ✅ ${ok} Saque(s) Aprovado(s)! |
| _buscarMetricas | app.js:8531 | Selecione o período | Selecione O Período |
| _buscarMetricas | app.js:8532 | ⚠️ Período inválido | ⚠️ Período Inválido |
| _buscarMetricas | app.js:8532 | A data inicial não pode ser depois da final | A Data Inicial Não Pode Ser Depois Da Final |
| _buscarMetricas | app.js:8599 | 🏦 Meta de Caixa Operacional - Banco do Brasil 1% | 🏦 Meta De Caixa Operacional - Banco Do Brasil 1% |
| _buscarMetricas | app.js:8600 | ⚡ Meta de Conta Salário - Caixa Econômica Federal 1% | ⚡ Meta De Conta Salário - Caixa Econômica Federal 1% |
| _buscarMetricas | app.js:8601 | 🏦 Meta de Caixa Saque Rápido - ITAU 5% | 🏦 Meta De Caixa Saque Rápido - ITAU 5% |
| _buscarMetricas | app.js:8602 | 🏠 Meta Patrimônio em Imóveis | 🏠 Meta Patrimônio Em Imóveis |
| _buscarMetricas | app.js:8603 | 💵 Meta Patrimônio em Dólar - Banco nos Estados Unidos | 💵 Meta Patrimônio Em Dólar - Banco Nos Estados Unidos |
| _buscarMetricas | app.js:8604 | 💶 Meta Patrimônio em Euro - Banco na Europa | 💶 Meta Patrimônio Em Euro - Banco Na Europa |
| _carregarListaConversasAdmin | app.js:781 | Nenhuma conversa ainda | Nenhuma Conversa Ainda |
| _carregarListaConversasAdmin | app.js:789 | 🚨 QUER SAIR DO PEDIDO — responder rápido | 🚨 Quer Sair Do Pedido — Responder Rápido |
| _carregarSaldoTopbar | app.js:3182 | ⚠️ Saldo baixo! Recarregue seu saldo para continuar criando entregas. | ⚠️ Saldo Baixo! Recarregue Seu Saldo Para Continuar Criando Entregas. |
| _claCardHtml | app.js:10608 | Nenhum clã criado pra essa cidade ainda. | Nenhum Clã Criado Pra Essa Cidade Ainda. |
| _claCardHtml | app.js:10611 | ${_icone('plus',16,'btn-ico')}Criar Clã de ${cidade} | ${_icone('plus',16,'btn-ico')}Criar Clã De ${cidade} |
| _claVerLista | app.js:10661 | Nenhum selecionado ainda | Nenhum Selecionado Ainda |
| _cliCalcular | app.js:13403 | hojeN-x.d | HojeN-X.d |
| _cliCalcular | app.js:13405 | hojeN-c.primeiro | HojeN-C.primeiro |
| _cliRenderLista | app.js:13485 | Nenhum cliente encontrado${busca?' para essa busca':''}. | Nenhum Cliente encontrado${busca?' para essa busca':''}. |
| _confirmarEntregaParceira | app.js:3067 | Solicitar um entregador sob demanda (${nome}) pro pedido #${p?.numero\|\|pedidoId.substring(0,6)}? Isso cria uma entrega de verdade e pode gerar custo. | Solicitar Um Entregador Sob Demanda (${nome}) Pro Pedido #${p?.numero\|\|pedidoId.substring(0,6)}? Isso Cria Uma Entrega De Verdade E Pode Gerar Custo. |
| _confirmarEntregaParceira | app.js:3068 | ⏳ Solicitando na ${nome}… | ⏳ Solicitando Na ${nome}… |
| _confirmarEntregaParceira | app.js:3074 | ❌ Falha ao solicitar ${nome} | ❌ Falha Ao Solicitar ${nome} |
| _confirmarEntregaParceira | app.js:3075 | Entregador sob demanda acionado. | Entregador Sob Demanda Acionado. |
| _confirmarEntregaParceira | app.js:3075 | ✅ ${nome} solicitada! | ✅ ${nome} Solicitada! |
| _confirmarEntregaParceira | app.js:3080 | ❌ Erro de conexão | ❌ Erro De Conexão |
| _confirmarImportarLojas | app.js:5963 | ⚠️ Importação parcial | ⚠️ Importação Parcial |
| _confirmarImportarLojas | app.js:5964 | ✅ Importação concluída! | ✅ Importação Concluída! |
| _confirmarReprovacao | app.js:6317 | Informe um motivo. | Informe Um Motivo. |
| _confirmarReprovacao | app.js:6333 | Erro ao salvar. | Erro Ao Salvar. |
| _confirmarReprovacao | app.js:6335 | ❌ Entregador reprovado | ❌ Entregador Reprovado |
| _confirmarReprovacaoDocumento | app.js:6474 | Informe um motivo. | Informe Um Motivo. |
| _confirmarReprovacaoDocumento | app.js:6477 | Erro ao salvar. | Erro Ao Salvar. |
| _confirmarReprovacaoDocumento | app.js:6480 | ❌ Documento reprovado | ❌ Documento Reprovado |
| _confirmarReprovacaoLoja | app.js:6079 | Informe um motivo. | Informe Um Motivo. |
| _confirmarReprovacaoLoja | app.js:6082 | Erro ao salvar. | Erro Ao Salvar. |
| _confirmarReprovacaoLoja | app.js:6085 | ❌ Loja reprovada | ❌ Loja Reprovada |
| _copiarCodigoPix | app.js:3487 | ✅ Código Pix copiado! | ✅ Código Pix Copiado! |
| _copiarCodigoPix | app.js:3487 | Cole no app do seu banco | Cole No App Do Seu Banco |
| _copiarRastreio | app.js:4618 | ✅ Link copiado! | ✅ Link Copiado! |
| _crCalcularTaxa | app.js:2541 | distKm | DistKm |
| _criarCla | app.js:10686 | ❌ Erro ao criar clã | ❌ Erro Ao Criar Clã |
| _criarCla | app.js:10687 | ✅ Clã criado | ✅ Clã Criado |
| _criarPedidoInterno | app.js:5501 | Endereço obrigatório | Endereço Obrigatório |
| _criarPedidoInterno | app.js:5502 | Nome do cliente obrigatório | Nome Do Cliente Obrigatório |
| _criarPedidoInterno | app.js:5503 | Complemento obrigatório | Complemento Obrigatório |
| _criarPedidoInterno | app.js:5504 | Selecione a loja | Selecione A Loja |
| _criarPedidoInterno | app.js:5505 | Informe data/hora do agendamento | Informe Data/Hora Do Agendamento |
| _criarPedidoInterno | app.js:5506 | O horário do agendamento já passou — confira a data e hora | O Horário Do Agendamento Já Passou — Confira A Data E Hora |
| _criarPedidoInterno | app.js:5508 | 📍 Localizando endereço... | 📍 Localizando Endereço... |
| _criarPedidoInterno | app.js:5510 | ❌ Endereço não encontrado. Verifique e tente novamente. | ❌ Endereço Não Encontrado. Verifique E Tente Novamente. |
| _criarPedidoInterno | app.js:5516 | Você acabou de criar uma entrega (#${_dupNp.numero}) para este mesmo endereço há poucos minutos.\nDeseja criar outra entrega mesmo assim? | Você Acabou De Criar Uma Entrega (#${_dupNp.numero}) Para Este Mesmo Endereço Há Poucos Minutos.\nDeseja Criar Outra Entrega Mesmo Assim? |
| _criarPedidoInterno | app.js:5532 | Distância excedida | Distância Excedida |
| _criarPedidoInterno | app.js:5532 | Para distâncias maiores que 32km, procure o Expansão responsável da região. | Para Distâncias Maiores Que 32km, Procure O Expansão Responsável Da Região. |
| _criarPedidoInterno | app.js:5538 | distKm | DistKm |
| _criarPedidoInterno | app.js:5540 | ⏳ Criando pedido... | ⏳ Criando Pedido... |
| _criarPedidoInterno | app.js:5571 | Pedido #${numero} criado! | Pedido #${numero} Criado! |
| _criarPedidoInterno | app.js:5572 | Pedido criado! | Pedido Criado! |
| _criarPedidoInterno | app.js:5572 | Ficará pronto em 60s | Ficará Pronto Em 60s |
| _criarPedidoInterno | app.js:5573 | ❌ Erro ao criar pedido. | ❌ Erro Ao Criar Pedido. |
| _desativarPdCidade | app.js:7220 | ⏰ Preço dinâmico ${cidade} desativado automaticamente | ⏰ Preço Dinâmico ${cidade} Desativado Automaticamente |
| _desativarPrecoDinamico | app.js:6952 | ⏰ Preço dinâmico desativado automaticamente | ⏰ Preço Dinâmico Desativado Automaticamente |
| _dispararWhatsappEmRota | app.js:12138 | 📲 WhatsApp enviado! | 📲 WhatsApp Enviado! |
| _enviarFaturaHistorico | app.js:11667 | Cobrança não encontrada | Cobrança Não Encontrada |
| _enviarFaturaHistorico | app.js:11669 | ⚠️ Evolution API não configurada | ⚠️ Evolution API Não Configurada |
| _enviarFaturaHistorico | app.js:11671 | ⚠️ Loja sem WhatsApp cadastrado | ⚠️ Loja Sem WhatsApp Cadastrado |
| _enviarFaturaHistorico | app.js:11674 | 📲 Fatura enviada! | 📲 Fatura Enviada! |
| _enviarFaturaHistorico | app.js:11674 | ❌ Falha ao enviar fatura | ❌ Falha Ao Enviar Fatura |
| _enviarMensagemChat | app.js:693 | ❌ Erro ao enviar | ❌ Erro Ao Enviar |
| _enviarMensagemChat | app.js:693 | Não foi possível enviar a mensagem | Não Foi Possível Enviar A Mensagem |
| _epRecalcularTaxas | app.js:5094 | ❌ Endereço não encontrado | ❌ Endereço Não Encontrado |
| _escalaItem | app.js:8451 | meta a definir | Meta A Definir |
| _feriadoExcluir | app.js:11045 | Excluir esse feriado? | Excluir Esse Feriado? |
| _feriadoSalvar | app.js:11036 | Selecione uma data | Selecione Uma Data |
| _feriadoSalvar | app.js:11038 | Data já cadastrada ou inválida | Data Já Cadastrada Ou Inválida |
| _feriadosBuscar | app.js:11023 | Nenhum feriado cadastrado. | Nenhum Feriado Cadastrado. |
| _fetchPdAtual | app.js:6793 | global+cidade | Global+cidade |
| _fetchPdAtual | app.js:6798 | global+cidade | Global+cidade |
| _flBuscar | app.js:10498 | Nenhuma fatura no histórico | Nenhuma Fatura No Histórico |
| _gerarCobranca | app.js:11742 | Selecione ao menos uma loja | Selecione Ao Menos Uma Loja |
| _gerarCobranca | app.js:11750 | ✅ ${ok} cobrança(s) gerada(s)! | ✅ ${ok} Cobrança(s) Gerada(s)! |
| _gerarPagamento | app.js:11298 | Selecione ao menos um entregador | Selecione Ao Menos Um Entregador |
| _gerarPagamento | app.js:11310 | ✅ ${ok} pagamento(s) gerado(s)! | ✅ ${ok} Pagamento(s) Gerado(s)! |
| _gerarPagamento | app.js:11317 | ❌ Erro ao gerar pagamento | ❌ Erro Ao Gerar Pagamento |
| _gerarPagamento | app.js:11317 | Verifique as permissões da tabela saques no Supabase | Verifique As Permissões Da Tabela Saques No Supabase |
| _htmlSobDemandaInline | app.js:3025 | Selecione uma opção de entrega parceira para este pedido | Selecione Uma Opção De Entrega Parceira Para Este Pedido |
| _ifoodAddFiltrarLojas | app.js:12870 | 🔎 Nenhuma loja encontrada | 🔎 Nenhuma Loja Encontrada |
| _ifoodResponderTroca | app.js:3586 | ✅ Endereço atualizado | ✅ Endereço Atualizado |
| _ifoodResponderTroca | app.js:3586 | Troca de endereço rejeitada | Troca De Endereço Rejeitada |
| _ifoodResponderTroca | app.js:3589 | Falha ao responder troca de endereço | Falha Ao Responder Troca De Endereço |
| _ifoodValidarCodigo | app.js:3656 | Digite o código | Digite O Código |
| _ifoodValidarCodigo | app.js:3660 | Código não validado | Código Não Validado |
| _ifoodValidarCodigo | app.js:3661 | ✅ Código validado | ✅ Código Validado |
| _ifoodValidarCodigo | app.js:3664 | Falha ao validar código | Falha Ao Validar Código |
| _lojaSetPeriodoCrescimento | app.js:4132 | vs. período anterior | Vs. Período Anterior |
| _lojaSetPeriodoCrescimento | app.js:4134 | Sem período anterior pra comparar | Sem Período Anterior Pra Comparar |
| _mcAbrirModalCategoria | app.js:13588 | Nome da Categoria | Nome Da Categoria |
| _mcAbrirModalProduto | app.js:13642 | Nome do Produto | Nome Do Produto |
| _mcAbrirModalProduto | app.js:13643 | Ingredientes, observações... | Ingredientes, Observações... |
| _mcAbrirModalProduto | app.js:13650 | Foto do Produto | Foto Do Produto |
| _mcAbrirModalProduto | app.js:13654 | URL da foto ou escolha arquivo abaixo | URL Da Foto Ou Escolha Arquivo Abaixo |
| _mcAbrirModalProduto | app.js:13655 | ${_icone('camera',16,'btn-ico')}Escolher imagem (máx. 2MB) | ${_icone('camera',16,'btn-ico')}Escolher Imagem (Máx. 2MB) |
| _mcCarregarCategorias | app.js:13524 | Nenhuma categoria. | Nenhuma Categoria. |
| _mcCarregarCategorias | app.js:13524 | Crie a primeira! | Crie A Primeira! |
| _mcExcluirProduto | app.js:13739 | Excluir "${nome}"? Esta ação não pode ser desfeita. | Excluir "${nome}"? Esta Ação Não Pode Ser Desfeita. |
| _mcExcluirProduto | app.js:13742 | 🗑️ Produto excluído | 🗑️ Produto Excluído |
| _mcPreviewFoto | app.js:13668 | Arquivo muito grande | Arquivo Muito Grande |
| _mcPreviewFoto | app.js:13674 | ✅ ${file.name} pronto para upload | ✅ ${file.name} Pronto Para Upload |
| _mcSalvarCategoria | app.js:13604 | Nome é obrigatório. | Nome É Obrigatório. |
| _mcSalvarCategoria | app.js:13618 | ✅ Categoria atualizada! | ✅ Categoria Atualizada! |
| _mcSalvarCategoria | app.js:13618 | ✅ Categoria criada! | ✅ Categoria Criada! |
| _mcSalvarProduto | app.js:13702 | Nome é obrigatório. | Nome É Obrigatório. |
| _mcSalvarProduto | app.js:13715 | ⏳ Enviando foto... | ⏳ Enviando Foto... |
| _mcSalvarProduto | app.js:13718 | ⚠️ Foto não enviada, produto salvo sem ela. | ⚠️ Foto Não Enviada, Produto Salvo Sem Ela. |
| _mcSalvarProduto | app.js:13730 | ✅ Produto atualizado! | ✅ Produto Atualizado! |
| _mcSalvarProduto | app.js:13730 | ✅ Produto criado! | ✅ Produto Criado! |
| _mcToggleCategoria | app.js:13626 | Categoria inativa. | Categoria Inativa. |
| _offsetCoordDuplicada | app.js:4967 | ⏳ Aguardando aceite | ⏳ Aguardando Aceite |
| _recalcularEnderecosDadosPendentes | app.js:5987 | ℹ️ Nada pra recalcular | ℹ️ Nada Pra Recalcular |
| _recalcularEnderecosDadosPendentes | app.js:5987 | Nenhuma loja "Dados pendentes" com endereço cadastrado no momento | Nenhuma Loja "Dados Pendentes" Com Endereço Cadastrado No Momento |
| _recalcularEnderecosDadosPendentes | app.js:5988 | Recalcular endereço de ${lojas.length} loja${lojas.length===1?'':'s'} marcada${lojas.length===1?'':'s'} "Dados pendentes"? Isso busca a coordenada de novo a partir do endereço cadastrado hoje. | Recalcular Endereço De ${lojas.length} loja${lojas.length===1?'':'s'} marcada${lojas.length===1?'':'s'} "Dados Pendentes"? Isso Busca A Coordenada De Novo A Partir Do Endereço Cadastrado Hoje. |
| _recalcularEnderecosDadosPendentes | app.js:6004 | ✅ Recálculo concluído | ✅ Recálculo Concluído |
| _recalcularEnderecosDadosPendentes | app.js:6004 | ⚠️ Nenhuma coordenada atualizada | ⚠️ Nenhuma Coordenada Atualizada |
| _recarregarListaLojas | app.js:6420 | Foto de Perfil | Foto De Perfil |
| _recarregarListaLojas | app.js:6423 | Comprovante de Residência | Comprovante De Residência |
| _recarregarListaLojas | app.js:6424 | Foto da Placa | Foto Da Placa |
| _renderClasTab | app.js:10597 | Nenhuma cidade com loja cadastrada ainda. | Nenhuma Cidade Com Loja Cadastrada Ainda. |
| _renderClientesAppTab | app.js:6101 | 🔎 Buscar por nome, telefone, e-mail ou CPF | 🔎 Buscar Por Nome, Telefone, E-mail Ou CPF |
| _renderClientesAppTab | app.js:6106 | Cadastrado em | Cadastrado Em |
| _renderClientesAppTab | app.js:6108 | Nenhum cliente encontrado | Nenhum Cliente Encontrado |
| _renderConfigLogsIfood | app.js:12687 | Log de erros da integração (autenticação, polling de pedidos, envio de status de volta pro iFood). Toda falha aparece aqui — nada acontece em silêncio. | Log De Erros Da Integração (Autenticação, Polling De Pedidos, Envio De Status De Volta Pro iFood). Toda Falha Aparece Aqui — Nada Acontece Em Silêncio. |
| _renderDonutCategoria | app.js:8853 | 🔎 Clique numa fatia ou item da legenda pra detalhar por marca | 🔎 Clique Numa Fatia Ou Item Da Legenda Pra Detalhar Por Marca |
| _renderHistoricoAprovarSaques | app.js:11346 | 📜 Histórico de Saques | 📜 Histórico De Saques |
| _renderHistoricoAprovarSaques | app.js:11348 | Aprovado em | Aprovado Em |
| _renderHistoricoCobrancas | app.js:11829 | Nenhum histórico encontrado | Nenhum Histórico Encontrado |
| _renderHistoricoCobrancas | app.js:11832 | 📜 Histórico de Cobranças | 📜 Histórico De Cobranças |
| _renderHistoricoSaqueRapido | app.js:11581 | 📜 Histórico de Saques Rápidos | 📜 Histórico De Saques Rápidos |
| _renderHistoricoSaqueRapido | app.js:11583 | Aprovado em | Aprovado Em |
| _renderLojaChartCrescimento | app.js:4046 | Sem dados suficientes no período | Sem Dados Suficientes No Período |
| _renderMensagensChat | app.js:657 | Nenhuma mensagem ainda. Envie a primeira! | Nenhuma Mensagem Ainda. Envie A Primeira! |
| _renderMetricasChart | app.js:8690 | Selecione um período válido | Selecione Um Período Válido |
| _renderPrecoDinamicoTab | app.js:6847 | Cobrança da Loja | Cobrança Da Loja |
| _renderPrecoDinamicoTab | app.js:6847 | Pagamento do Entregador | Pagamento Do Entregador |
| _renderPrecoDinamicoTab | app.js:6854 | Valor fixo extra somado à taxa cobrada da loja em todos os pedidos. | Valor Fixo Extra Somado À Taxa Cobrada Da Loja Em Todos Os Pedidos. |
| _renderPrecoDinamicoTab | app.js:6854 | Valor fixo extra somado ao pagamento do entregador em todos os pedidos. | Valor Fixo Extra Somado Ao Pagamento Do Entregador Em Todos Os Pedidos. |
| _renderRankingLista | app.js:10556 | Top 10 da semana atual por pontos — só informativo, sem pagamento automático. | Top 10 Da Semana Atual Por Pontos — Só Informativo, Sem Pagamento Automático. |
| _renderRankingLista | app.js:10560 | Nenhum entregador com pontos ainda | Nenhum Entregador Com Pontos Ainda |
| _renderRankingLista | app.js:10562 | Pontos (semana) | Pontos (Semana) |
| _renderUsuariosTab | app.js:6639 | Criado em | Criado Em |
| _renderUsuariosTab | app.js:6643 | Nenhum usuário | Nenhum Usuário |
| _renderVendedoresTab | app.js:7362 | Criado em | Criado Em |
| _renderVendedoresTab | app.js:7369 | Nenhum vendedor cadastrado | Nenhum Vendedor Cadastrado |
| _reprovarLoja | app.js:6065 | Informe o motivo da reprovação de | Informe O Motivo Da Reprovação De |
| _runAuditoria | app.js:9805 | ❌ Erro ao buscar pedidos. | ❌ Erro Ao Buscar Pedidos. |
| _runAuditoria | app.js:9887 | ✅ Nenhum problema encontrado no período (${pedidos.length} pedido(s) verificado(s)) | ✅ Nenhum Problema Encontrado No Período (${pedidos.length} Pedido(s) Verificado(s)) |
| _runAuditoria | app.js:9901 | ⚠️ ${problemas.length} problema(s) encontrado(s) em ${pedidos.length} pedido(s) | ⚠️ ${problemas.length} Problema(s) Encontrado(s) Em ${pedidos.length} Pedido(s) |
| _runAuditoria | app.js:9906 | ❌ Erro ao rodar verificações: ${e?.message\|\|String(e)} | ❌ Erro Ao Rodar Verificações: ${e?.message\|\|String(e)} |
| _salvarCla | app.js:10701 | ✅ Clã atualizado | ✅ Clã Atualizado |
| _salvarConfigEvolution | app.js:12207 | ✅ Configuração salva! | ✅ Configuração Salva! |
| _salvarConfigEvolution | app.js:12207 | Evolution API configurada | Evolution API Configurada |
| _salvarConfigOperacao | app.js:13037 | Informe o raio de busca | Informe O Raio De Busca |
| _salvarMeta | app.js:8673 | ⚠️ Valor inválido | ⚠️ Valor Inválido |
| _salvarMeta | app.js:8673 | Digite um valor válido em R$ | Digite Um Valor Válido Em R$ |
| _salvarMeta | app.js:8679 | ❌ Erro ao salvar | ❌ Erro Ao Salvar |
| _salvarMeta | app.js:8679 | Não foi possível salvar o valor | Não Foi Possível Salvar O Valor |
| _salvarMeta | app.js:8680 | ✅ Valor salvo! | ✅ Valor Salvo! |
| _setCadastroStatus | app.js:6376 | Status atualizado: ${novoStatus} | Status Atualizado: ${novoStatus} |
| _setCadastroStatusLoja | app.js:6056 | Status atualizado: ${novoStatus} | Status Atualizado: ${novoStatus} |
| _srSalvarCaixa | app.js:11472 | Valor inválido | Valor Inválido |
| _srSalvarCaixa | app.js:11475 | ✅ Caixa atualizado! | ✅ Caixa Atualizado! |
| _toggleStatusEntregador | app.js:6272 | ❌ Erro ao atualizar status | ❌ Erro Ao Atualizar Status |
| _toggleStatusEntregador | app.js:6276 | 🚫 Entregador bloqueado | 🚫 Entregador Bloqueado |
| _toggleStatusEntregador | app.js:6276 | ✅ Entregador desbloqueado | ✅ Entregador Desbloqueado |
| _verificarAgendados | app.js:4363 | 🔔 Pedido #${p.numero\|\|p.id.substring(0,6)} — Agendamento ativado! | 🔔 Pedido #${p.numero\|\|p.id.substring(0,6)} — Agendamento Ativado! |
| abrirDropdownStatusRelatorio | app.js:8890 | Não é possível alterar pedidos de semanas anteriores | Não É Possível Alterar Pedidos De Semanas Anteriores |
| abrirEditarUsuario | app.js:6653 | Selecione a loja | Selecione A Loja |
| abrirEditarUsuario | app.js:6654 | Deixe em branco para não alterar | Deixe Em Branco Para Não Alterar |
| abrirModalUsuario | app.js:9697 | Selecione a loja | Selecione A Loja |
| adicionarFaixa | app.js:13120 | ✅ Faixa adicionada! | ✅ Faixa Adicionada! |
| alocarMotoboy | app.js:5259 | Esse pedido já está com um entregador em andamento (status: ${STATUS_LABEL[_p.status]\|\|_p.status}).\n\nAlocar ${motoboyNome} agora vai DESALOCAR o entregador atual e reabrir o pedido como disponível. O entregador atual será avisado por notificação, mas o pedido sai da rota dele imediatamente.\n\nConfirma a realocação? | Esse Pedido Já Está Com Um Entregador Em Andamento (Status: ${STATUS_LABEL[_p.status]\|\|_p.status}).\n\nAlocar ${motoboyNome} Agora Vai DESALOCAR O Entregador Atual E Reabrir O Pedido Como Disponível. O Entregador Atual Será Avisado Por Notificação, Mas O Pedido Sai Da Rota Dele Imediatamente.\n\nConfirma A Realocação? |
| alocarMotoboy | app.js:5264 | Entregador bloqueado nesta loja | Entregador Bloqueado Nesta Loja |
| alocarMotoboy | app.js:5275 | ❌ Limite de entregas simultâneas | ❌ Limite De Entregas Simultâneas |
| alocarMotoboy | app.js:5308 | ✅ Motoboy alocado! | ✅ Motoboy Alocado! |
| alterarStatusPedido | app.js:2924 | ❌ Pedido cancelado | ❌ Pedido Cancelado |
| alterarStatusPedidoRelatorio | app.js:8899 | Não é possível alterar pedidos de semanas anteriores | Não É Possível Alterar Pedidos De Semanas Anteriores |
| alterarStatusPedidoRelatorio | app.js:8905 | Cancelar o pedido #${p.numero\|\|p.id?.substring(0,6)}?\nEsta ação pode ser revertida alterando o status novamente. | Cancelar O Pedido #${p.numero\|\|p.id?.substring(0,6)}?\nEsta Ação Pode Ser Revertida Alterando O Status Novamente. |
| alterarStatusPedidoRelatorio | app.js:8917 | ✅ Status alterado | ✅ Status Alterado |
| alterarStatusPedidoRelatorio | app.js:8918 | ❌ Erro ao alterar status | ❌ Erro Ao Alterar Status |
| calcularDistanciaRota | app.js:5377 | routes.distanceMeters,routes.polyline.encodedPolyline | Routes.distanceMeters,routes.polyline.encodedPolyline |
| calcularDistanciaRota | app.js:5377 | routes.distanceMeters | Routes.distanceMeters |
| carregarRelatorio | app.js:9766 | Nenhum pedido no período | Nenhum Pedido No Período |
| clonarTabela | app.js:13146 | Tabela não encontrada | Tabela Não Encontrada |
| clonarTabela | app.js:13150 | Falha ao clonar | Falha Ao Clonar |
| clonarTabela | app.js:13152 | ✅ Tabela clonada! | ✅ Tabela Clonada! |
| confirmarPagamento | app.js:3507 | ✅ Pagamento confirmado! | ✅ Pagamento Confirmado! |
| confirmarPagamento | app.js:3507 | Entrega finalizada para o motoboy | Entrega Finalizada Para O Motoboy |
| criarNovoEntregador | app.js:6620 | Preencha nome, e-mail e senha. | Preencha Nome, E-mail E Senha. |
| criarNovoEntregador | app.js:6621 | Senha mínima de 6 caracteres. | Senha Mínima De 6 Caracteres. |
| criarNovoEntregador | app.js:6622 | CPF inválido. Use o formato 000.000.000-00. | CPF Inválido. Use O Formato 000.000.000-00. |
| criarNovoEntregador | app.js:6625 | CPF já cadastrado no sistema. | CPF Já Cadastrado No Sistema. |
| criarNovoEntregador | app.js:6627 | Criando conta… | Criando Conta… |
| criarNovoEntregador | app.js:6633 | ✅ Entregador criado! | ✅ Entregador Criado! |
| criarNovoEntregador | app.js:6635 | Erro de conexão. | Erro De Conexão. |
| enviarCadastroLoja | app.js:9247 | Preencha todos os campos. | Preencha Todos Os Campos. |
| enviarCadastroLoja | app.js:9248 | CPF ou CNPJ inválido — confere os números. | CPF Ou CNPJ Inválido — Confere Os Números. |
| enviarCadastroLoja | app.js:9249 | Senha mínima de 6 caracteres. | Senha Mínima De 6 Caracteres. |
| enviarCadastroLoja | app.js:9250 | ⏳ Enviando cadastro... | ⏳ Enviando Cadastro... |
| enviarCadastroLoja | app.js:9252 | 📍 Geocodificando endereço... | 📍 Geocodificando Endereço... |
| enviarCadastroLoja | app.js:9254 | ✅ Cadastro enviado! Você será avisado quando for aprovado. | ✅ Cadastro Enviado! Você Será Avisado Quando For Aprovado. |
| enviarCadastroLoja | app.js:9255 | ✅ Cadastro enviado! | ✅ Cadastro Enviado! |
| enviarCadastroLoja | app.js:9255 | Nosso time vai analisar e liberar seu acesso em breve. | Nosso Time Vai Analisar E Liberar Seu Acesso Em Breve. |
| excluirEntregador | app.js:6381 | Excluir permanentemente?\nO histórico de pedidos será mantido. | Excluir Permanentemente?\nO Histórico De Pedidos Será Mantido. |
| excluirEntregador | app.js:6387 | 🗑️ Entregador excluído | 🗑️ Entregador Excluído |
| excluirFaixa | app.js:13089 | 🗑️ Faixa excluída | 🗑️ Faixa Excluída |
| excluirLoja | app.js:6392 | Tem certeza que deseja excluir a loja "${nome}"?\nEsta ação não pode ser desfeita. | Tem Certeza Que Deseja Excluir A Loja "${nome}"?\nEsta Ação Não Pode Ser Desfeita. |
| excluirLoja | app.js:6396 | 🗑️ Loja excluída | 🗑️ Loja Excluída |
| excluirTabela | app.js:13134 | Excluir tabela e faixas? | Excluir Tabela E Faixas? |
| fazerLogin | app.js:3890 | Preencha e-mail e senha. | Preencha E-mail E Senha. |
| fazerLogin | app.js:3897 | E-mail, senha ou perfil incorretos. | E-mail, Senha Ou Perfil Incorretos. |
| fazerLogin | app.js:3900 | E-mail, senha ou perfil incorretos. | E-mail, Senha Ou Perfil Incorretos. |
| goTab | app.js:3970 | Aqui você vai poder ver os dados da sua conta e trocar sua senha. | Aqui Você Vai Poder Ver Os Dados Da Sua Conta E Trocar Sua Senha. |
| goTab | app.js:3970 | Essa seção das configurações da loja ainda está sendo construída. | Essa Seção Das Configurações Da Loja Ainda Está Sendo Construída. |
| iniciarAutocompleteEndereco | app.js:14218 | ⚠️ Selecione um endereço da lista | ⚠️ Selecione Um Endereço Da Lista |
| recusarCobranca | app.js:11885 | Não foi possível recusar a cobrança | Não Foi Possível Recusar A Cobrança |
| recusarCobranca | app.js:11887 | ❌ Cobrança recusada | ❌ Cobrança Recusada |
| recusarSaque | app.js:11405 | Não foi possível recusar o saque | Não Foi Possível Recusar O Saque |
| recusarSaque | app.js:11407 | Saque já processado | Saque Já Processado |
| recusarSaque | app.js:11407 | Esse saque não estava mais pendente — nada foi alterado. | Esse Saque Não Estava Mais Pendente — Nada Foi Alterado. |
| recusarSaque | app.js:11411 | ❌ Saque recusado | ❌ Saque Recusado |
| recusarSaque | app.js:11411 | Saque foi recusado | Saque Foi Recusado |
| recusarSaqueRapido | app.js:11561 | Não foi possível recusar o saque | Não Foi Possível Recusar O Saque |
| recusarSaqueRapido | app.js:11563 | Saque já processado | Saque Já Processado |
| recusarSaqueRapido | app.js:11563 | Esse saque não estava mais pendente — nada foi alterado. | Esse Saque Não Estava Mais Pendente — Nada Foi Alterado. |
| recusarSaqueRapido | app.js:11568 | ❌ Saque recusado | ❌ Saque Recusado |
| recusarSaqueRapido | app.js:11568 | Saque foi recusado | Saque Foi Recusado |
| renderAuditoriaPage | app.js:9770 | Sem acesso | Sem Acesso |
| renderFinanceiroPage | app.js:9958 | Contas a Pagar | Contas A Pagar |
| renderLogsPage | app.js:9911 | ${_icone('scroll-text',22)} Logs de Ações | ${_icone('scroll-text',22)} Logs De Ações |
| renderLogsPage | app.js:9914 | Nenhum log | Nenhum Log |
| renderLojaPedidosPage | app.js:13160 | Nenhum pedido | Nenhum Pedido |
| renderMeuCardapioPage | app.js:13491 | Nenhuma loja associada ao seu usuário. | Nenhuma Loja Associada Ao Seu Usuário. |
| renderMeuCardapioPage | app.js:13509 | ← Selecione uma categoria | ← Selecione Uma Categoria |
| renderMotoboyPage | app.js:8925 | Nenhum motoboy | Nenhum Motoboy |
| renderTabelaMapa | app.js:4462 | Nenhum pedido encontrado | Nenhum Pedido Encontrado |
| renderTabelasPrecoPage | app.js:13056 | ${_icone('circle-dollar-sign',22)} Cobrança e Pagamento | ${_icone('circle-dollar-sign',22)} Cobrança E Pagamento |
| renderWhatsappPage | app.js:12216 | ${_icone('bike',16,'btn-ico')}Mensagem em Rota | ${_icone('bike',16,'btn-ico')}Mensagem Em Rota |
| renomearTabela | app.js:13139 | Não foi possível renomear | Não Foi Possível Renomear |
| renomearTabela | app.js:13140 | ✅ Tabela renomeada! | ✅ Tabela Renomeada! |
| salvarEdicaoEntregador | app.js:6554 | E-mail inválido. | E-mail Inválido. |
| salvarEdicaoEntregador | app.js:6556 | Atualizando e-mail… | Atualizando E-mail… |
| salvarEdicaoEntregador | app.js:6565 | ❌ Erro ao atualizar e-mail: ${data.error\|\|r.status} | ❌ Erro Ao Atualizar E-mail: ${data.error\|\|r.status} |
| salvarEdicaoEntregador | app.js:6566 | ❌ Falha ao atualizar e-mail | ❌ Falha Ao Atualizar E-mail |
| salvarEdicaoEntregador | app.js:6569 | ❌ Erro de conexão ao atualizar e-mail. | ❌ Erro De Conexão Ao Atualizar E-mail. |
| salvarEdicaoEntregador | app.js:6575 | Nova senha precisa ter no mínimo 6 caracteres. | Nova Senha Precisa Ter No Mínimo 6 Caracteres. |
| salvarEdicaoEntregador | app.js:6576 | Atualizando senha… | Atualizando Senha… |
| salvarEdicaoEntregador | app.js:6578 | ❌ Erro ao redefinir senha: ${resSenha.error} | ❌ Erro Ao Redefinir Senha: ${resSenha.error} |
| salvarEdicaoEntregador | app.js:6604 | ✅ Salvo com sucesso! | ✅ Salvo Com Sucesso! |
| salvarEdicaoEntregador | app.js:6604 | ✅ Entregador atualizado com sucesso! | ✅ Entregador Atualizado Com Sucesso! |
| salvarEdicaoFaixa | app.js:13132 | ✅ Faixa atualizada! | ✅ Faixa Atualizada! |
| salvarEdicaoPedido | app.js:5121 | O horário do agendamento já passou — confira a data e hora. | O Horário Do Agendamento Já Passou — Confira A Data E Hora. |
| salvarEdicaoPedido | app.js:5165 | ❌ Erro ao salvar. | ❌ Erro Ao Salvar. |
| salvarEdicaoPedido | app.js:5165 | ❌ Erro ao salvar pedido | ❌ Erro Ao Salvar Pedido |
| salvarEdicaoPedido | app.js:5186 | ✅ Pedido atualizado! | ✅ Pedido Atualizado! |
| salvarEdicaoUsuario | app.js:6664 | Nova senha precisa ter no mínimo 6 caracteres. | Nova Senha Precisa Ter No Mínimo 6 Caracteres. |
| salvarEdicaoUsuario | app.js:6665 | Atualizando senha… | Atualizando Senha… |
| salvarEdicaoUsuario | app.js:6667 | ❌ Erro ao redefinir senha: ${resSenha.error} | ❌ Erro Ao Redefinir Senha: ${resSenha.error} |
| salvarEdicaoUsuario | app.js:6673 | ✅ Salvo com sucesso! | ✅ Salvo Com Sucesso! |
| salvarEdicaoUsuario | app.js:6673 | ✅ Usuário atualizado! | ✅ Usuário Atualizado! |
| salvarKmAdicional | app.js:13083 | Não foi possível salvar | Não Foi Possível Salvar |
| salvarKmAdicional | app.js:13086 | ✅ Taxa KM adicional salva! | ✅ Taxa KM Adicional Salva! |
| salvarKmAdicional | app.js:13093 | Não foi possível salvar | Não Foi Possível Salvar |
| salvarKmAdicional | app.js:13097 | ✅ Taxa KM adicional salva! | ✅ Taxa KM Adicional Salva! |
| salvarNovaTabela | app.js:13110 | Informe o nome | Informe O Nome |
| salvarNovaTabela | app.js:13118 | ✅ Tabela criada! | ✅ Tabela Criada! |
| salvarVendedor | app.js:7391 | Nome obrigatório. | Nome Obrigatório. |
| salvarVendedor | app.js:7396 | ✅ Vendedor salvo! | ✅ Vendedor Salvo! |

## Fora da troca

| arquivo:linha | Texto | Motivo |
|---|---|---|
| app.js:6302 | Informe o motivo da reprovação de | código sem uso |
| app.js:8987 | Preencha o endereço primeiro | código sem uso |
| app.js:8992 | ❌ Não encontrado | código sem uso |
| app.js:9120 | Preencha nome, e-mail e senha. | código sem uso |
| app.js:9121 | Senha mínima de 6 caracteres. | código sem uso |
| app.js:9129 | 📍 Geocodificando endereço... | código sem uso |
| app.js:9158 | ❌ Erro ao cadastrar loja. | código sem uso |
| app.js:9161 | ✅ Loja cadastrada! | código sem uso |
| app.js:9161 | Loja criada! | código sem uso |
| app.js:9689 | Criado em | código sem uso |
| app.js:9689 | ${_icone('users',22)} Usuários do Painel | código sem uso |
| app.js:9693 | Nenhum usuário | código sem uso |
| app.js:9704 | Preencha todos os campos. | código sem uso |
| app.js:9705 | Senha mínima de 6 caracteres. | código sem uso |
| app.js:9711 | ✅ Usuário cadastrado! | código sem uso |
| app.js:9711 | Usuário criado! | código sem uso |
| app.js:9712 | ❌ Erro. E-mail pode já estar cadastrado. | código sem uso |
