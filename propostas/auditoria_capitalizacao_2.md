# Auditoria de capitalização (2ª) — painel (loja, admin, suporte)

Segunda varredura (30/09/2026), incluindo textos montados com variáveis (${...}) e condicionais, no app.js atual e do hostinger/index.html. **Só leitura — nada foi alterado.**

**99 textos fora da regra** (96 no app.js, 3 no HTML do Hostinger), em 36 telas.

## Regras usadas

- Títulos, rótulos, botões, abas, menus, cabeçalhos de tabela e opções: Title Case, com minúsculas no meio para: de, do, da, dos, das, para, e, em, no, na, com, o, a.
- **A confirmar:** também deixei minúsculas **ao, aos, à, às, os, as, por, ou, nos, nas, pelo, pela, pro, pra, um, uma** (sem isso fica "CPF Ou CNPJ", "Pedidos Finalizados Por Categoria"). A coluna "só com a sua lista" mostra como ficaria sem esse acréscimo.
- Frases (avisos de sucesso/erro, "Carregando...", "Nenhum ... encontrado", instruções): só a 1ª letra maiúscula.
- Não entram: siglas (CPF, CNPJ, CEP, PDV, C.A.C., KM...), nomes próprios (Let's Go, iFood, WhatsApp, Pix, Google...), valores, e-mails, URLs, mensagens de WhatsApp, dados do banco (categorias, nomes de loja), textos entre parênteses (salvo quando o rótulo inteiro está em CAIXA ALTA) e trechos no meio de frases.
- "PIX" vira "Pix" (grafia oficial do Banco Central).

## Atenção antes de aprovar

- **8 rótulos em CAIXA ALTA** (ex.: "DATA INICIO", "LUCRO NO PERÍODO"): em vários cards e filtros a caixa alta é visual; onde o CSS já aplica text-transform uppercase, a aparência não muda. Posso deixar esses de fora.
- **10 itens marcados "não alterar"**: 8 são textos do carrossel que você aprovou (ficam como estão) e 2 são nomes de rede/categoria (IMC, DPSP).
- **7 frases**: a proposta só abaixa palavras maiúsculas no meio da frase — conferir nomes próprios.
- **6 itens estão em código sem uso** (menu antigo da loja, boas-vindas removida) — não aparecem na tela; sugiro ignorar.
- **3 itens do HTML do Hostinger** (login, modais fixos) só mudam em produção se o index.html for enviado de novo ao Hostinger.

## Resumo por tela

| Tela | Itens |
|---|---|
| Entrega Dedicada | 9 |
| Início da loja (carrossel) | 8 |
| C.A.C. | 6 |
| Notificações (disparo) | 6 |
| Pedidos | 6 |
| Cadastro de loja em etapas | 5 |
| Créditos | 5 |
| Boas-vindas da loja (removida) | 4 |
| Preço Dinâmico | 4 |
| Configuração → Integrações | 3 |
| Fatura (detalhe) | 3 |
| HTML do Hostinger (login e modais fixos) | 3 |
| Recarga de saldo (modal) | 3 |
| Cadastros → Entregadores | 2 |
| Cardápio digital | 2 |
| Gestor de Pedidos / Mapa | 2 |
| Novo Pedido | 2 |
| Pedidos (comanda) | 2 |
| Pedidos (detalhes) | 2 |
| Pedidos (editar pedido) | 2 |
| Pedidos (troca de endereço iFood) | 2 |
| Ranking → Clãs | 2 |
| Tabelas de Preço | 2 |
| Visão Executiva | 2 |
| Alocar Motoboy | 1 |
| Cadastros → Estabelecimentos | 1 |
| Cadastros → Importar lojas | 1 |
| Clientes (loja) | 1 |
| Configuração → iFood | 1 |
| Desempenho | 1 |
| Financeiro da loja | 1 |
| Lojas | 1 |
| Lojas (Nova Loja) | 1 |
| Pedidos (código iFood) | 1 |
| Pedidos (linha do tempo) | 1 |
| Usuários | 1 |

## Tabela completa (por tela)

### Entrega Dedicada

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:10843 | texto c/ variável | ${_icone('plus',14)} Nova vaga em ${dia}/${mes}/${ano} | ${_icone('plus',14)} Nova Vaga em ${dia}/${mes}/${ano} |  |  |
| app.js:10906 | condicional ?: | Vaga já finalizada | Vaga Já Finalizada |  |  |
| app.js:10906 | condicional ?: | Vaga já cancelada | Vaga Já Cancelada |  |  |
| app.js:10908 | condicional ?: | Vaga já tem entregador | Vaga Já Tem Entregador |  |  |
| app.js:10908 | condicional ?: | Dia já passou | Dia Já Passou |  |  |
| app.js:10909 | condicional ?: | Vaga sem entregador | Vaga Sem Entregador |  |  |
| app.js:10909 | condicional ?: | Dia já passou | Dia Já Passou |  |  |
| app.js:10910 | condicional ?: | Vaga sem entregador | Vaga Sem Entregador |  |  |
| app.js:10973 | texto c/ variável | ${_icone('check',16,'btn-ico')}Confirmar alocação | ${_icone('check',16,'btn-ico')}Confirmar Alocação |  |  |

### Início da loja (carrossel)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:13183 | botao: | Ver planos | Ver Planos |  | **não alterar: texto do carrossel aprovado por você** |
| app.js:13188 | titulo: | Entrega Dedicada: garanta entregadores fixos na sua loja | Entrega Dedicada: Garanta Entregadores Fixos na Sua Loja |  | **não alterar: texto do carrossel aprovado por você** |
| app.js:13193 | titulo: | Você já conhece as vantagens do crédito pré-pago? | Você Já Conhece as Vantagens do Crédito Pré-pago? | Você Já Conhece As Vantagens do Crédito Pré-pago? | **não alterar: texto do carrossel aprovado por você** |
| app.js:13194 | botao: | Recarregar agora | Recarregar Agora |  | **não alterar: texto do carrossel aprovado por você** |
| app.js:13195 | titulo: | Acompanhe seus clientes | Acompanhe Seus Clientes |  | **não alterar: texto do carrossel aprovado por você** |
| app.js:13195 | botao: | Ver meus clientes | Ver Meus Clientes |  | **não alterar: texto do carrossel aprovado por você** |
| app.js:13196 | titulo: | Acompanhe seu desempenho | Acompanhe Seu Desempenho |  | **não alterar: texto do carrossel aprovado por você** |
| app.js:13196 | botao: | Ver desempenho | Ver Desempenho |  | **não alterar: texto do carrossel aprovado por você** |

### C.A.C.

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:7300 | texto c/ variável | ${_icone('target',22)} C.A.C. — Custo de Aquisição de Cliente | ${_icone('target',22)} C.A.C. — custo de aquisição de cliente |  | frase |
| app.js:7340 | condicional ?: | Dentro do prazo | Dentro do Prazo |  |  |
| app.js:7340 | condicional ?: | Prazo encerrado | Prazo Encerrado |  |  |
| app.js:7344 | texto c/ variável | Resumo por vendedor — ${mes}/${ano} | Resumo por Vendedor — ${mes}/${ano} | Resumo Por Vendedor — ${mes}/${ano} |  |
| app.js:7345 | texto-html | Custo no mês (fixo + bônus) | Custo no Mês (fixo + bônus) |  |  |
| app.js:7373 | texto c/ variável | ${_escHtml(c.nome)} — fixo R$ ${parseFloat(c.salario_fixo).toFixed(2)} | ${_escHtml(c.nome)} — Fixo R$ ${parseFloat(c.salario_fixo).toFixed(2)} |  |  |

### Notificações (disparo)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:12312 | texto c/ variável | ${_icone('flask-conical',16,'btn-ico')}Testar comigo | ${_icone('flask-conical',16,'btn-ico')}Testar Comigo |  |  |
| app.js:12313 | texto c/ variável | ${_icone('megaphone',16,'btn-ico')}Enviar agora pra todos | ${_icone('megaphone',16,'btn-ico')}Enviar Agora pra Todos | ${_icone('megaphone',16,'btn-ico')}Enviar Agora Pra Todos |  |
| app.js:12324 | texto c/ variável | ${_icone('flask-conical',16,'btn-ico')}Testar comigo | ${_icone('flask-conical',16,'btn-ico')}Testar Comigo |  |  |
| app.js:12325 | texto c/ variável | ${_icone('megaphone',16,'btn-ico')}Enviar agora pra todos | ${_icone('megaphone',16,'btn-ico')}Enviar Agora pra Todos | ${_icone('megaphone',16,'btn-ico')}Enviar Agora Pra Todos |  |
| app.js:12330 | texto-html | 📅 Lembretes por dia da semana | 📅 Lembretes por Dia da Semana | 📅 Lembretes Por Dia da Semana |  |
| app.js:12464 | texto-html | ❌ Erro ao chamar a function | ❌ Erro ao Chamar a Function | ❌ Erro Ao Chamar a Function |  |

### Pedidos

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:4812 | texto-html | 🔒 Pedido já classificado como pronto | 🔒 Pedido Já Classificado Como Pronto |  |  |
| app.js:4814 | texto c/ variável | ${_icone('circle-dollar-sign',16,'btn-ico')}Pagamento recebido | ${_icone('circle-dollar-sign',16,'btn-ico')}Pagamento Recebido |  |  |
| app.js:4816 | texto c/ variável | ${_icone('link',16,'btn-ico')}Copiar rastreio | ${_icone('link',16,'btn-ico')}Copiar Rastreio |  |  |
| app.js:4859 | texto c/ variável | Saída Até ${horaSaidaAte} Para Evitar Atraso | Saída Até ${horaSaidaAte} para Evitar Atraso |  |  |
| app.js:7616 | condicional ?: | Crédito manual | Crédito Manual |  |  |
| app.js:7616 | condicional ?: | Débito manual | Débito Manual |  |  |

### Cadastro de loja em etapas

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:9299 | title-attr | Cadastre sua loja \| Let's Go | Cadastre Sua Loja \| Let's Go |  |  |
| app.js:9466 | texto c/ variável | Cadastrar agora ${_icone('arrow-right',18)} | Cadastrar Agora ${_icone('arrow-right',18)} |  |  |
| app.js:9575 | condicional ?: | Ocultar senha | Ocultar Senha |  |  |
| app.js:9575 | condicional ?: | Mostrar senha | Mostrar Senha |  |  |
| app.js:9675 | texto c/ variável | ${_icone('arrow-left',18)}Voltar ao login | ${_icone('arrow-left',18)}Voltar ao Login | ${_icone('arrow-left',18)}Voltar Ao Login |  |

### Créditos

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:10085 | condicional ?: | LOJA | Loja |  | caixa alta |
| app.js:10085 | condicional ?: | ENTREGADOR | Entregador |  | caixa alta |
| app.js:10106 | condicional ?: | VALOR PAGO PELA LOJA | Valor Pago pela Loja | Valor Pago Pela Loja | caixa alta |
| app.js:10106 | condicional ?: | VALOR | Valor |  | caixa alta |
| app.js:10121 | texto c/ variável | Total creditado: ${_rcgFmt(pac.pago+pac.bonus)} | Total Creditado: ${_rcgFmt(pac.pago+pac.bonus)} |  |  |

### Boas-vindas da loja (removida)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:4179 | texto-html | ↗ Crescimento da loja | ↗ Crescimento da Loja |  | código sem uso |
| app.js:4181 | texto-html | 7 dias | 7 Dias |  | código sem uso |
| app.js:4182 | texto-html | 30 dias | 30 Dias |  | código sem uso |
| app.js:4183 | texto-html | 6 meses | 6 Meses |  | código sem uso |

### Preço Dinâmico

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:7092 | condicional ?: | Desmarcar todos | Desmarcar Todos |  |  |
| app.js:7092 | condicional ?: | Selecionar todos | Selecionar Todos |  |  |
| app.js:7107 | condicional ?: | Selecionar todos | Selecionar Todos |  |  |
| app.js:7107 | condicional ?: | Desmarcar todos | Desmarcar Todos |  |  |

### Configuração → Integrações

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:12664 | texto-html | Cardápio digital / PDV e gestão | Cardápio Digital / PDV e Gestão |  |  |
| app.js:12692 | texto-html | 🏪 Vínculo de lojas — iFood | 🏪 Vínculo de Lojas — iFood |  |  |
| app.js:12693 | texto c/ variável | ${_icone('plus',16,'btn-ico')}Adicionar integração | ${_icone('plus',16,'btn-ico')}Adicionar Integração |  |  |

### Fatura (detalhe)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:11959 | condicional ?: | Total pago | Total Pago |  |  |
| app.js:11959 | condicional ?: | Total a pagar | Total a Pagar |  |  |
| app.js:11996 | texto c/ variável | ${_icone('send',16,'btn-ico')}Enviar comprovante no WhatsApp Financeiro | ${_icone('send',16,'btn-ico')}Enviar Comprovante no WhatsApp Financeiro |  |  |

### HTML do Hostinger (login e modais fixos)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| hostinger/index.html:428 | title-attr | Horário de brasília — conferência visual | Horário de Brasília — Conferência Visual |  |  |
| hostinger/index.html:503 | texto-html | IMC | Imc |  | caixa alta, **não alterar: dado (categoria/banco)** |
| hostinger/index.html:521 | texto-html | DPSP | Dpsp |  | caixa alta, **não alterar: dado (categoria/banco)** |

### Recarga de saldo (modal)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:3416 | texto c/ variável | ${_icone('badge-percent',12)} +${p.pct}% de bônus | ${_icone('badge-percent',12)} +${p.pct}% de Bônus |  |  |
| app.js:3457 | texto c/ variável | ${_icone('arrow-left',16)}Voltar aos pacotes | ${_icone('arrow-left',16)}Voltar aos Pacotes | ${_icone('arrow-left',16)}Voltar Aos Pacotes |  |
| app.js:3467 | texto c/ variável | ${_icone('message-circle',18)}Enviar comprovante pelo WhatsApp | ${_icone('message-circle',18)}Enviar Comprovante pelo WhatsApp | ${_icone('message-circle',18)}Enviar Comprovante Pelo WhatsApp |  |

### Cadastros → Entregadores

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:6248 | condicional ?: | 🟢 Entregador Online | 🟢 Entregador online |  | frase |
| app.js:6248 | condicional ?: | ⚫ Entregador Offline | ⚫ Entregador offline |  | frase |

### Cardápio digital

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:13559 | condicional ?: | Marcar indisponível | Marcar Indisponível |  |  |
| app.js:13559 | condicional ?: | Marcar disponível | Marcar Disponível |  |  |

### Gestor de Pedidos / Mapa

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:2558 | condicional ?: | Com ret | Com Ret |  |  |
| app.js:3132 | condicional ?: | 🔔 Pedido Pronto! | 🔔 Pedido pronto! |  | frase |

### Novo Pedido

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:2754 | texto c/ variável | ✅ ${distKm.toFixed(2)} km (${origemUsada}) → Taxa: R$ ${_totalDisplay.toFixed(2)} | ✅ ${distKm.toFixed(2)} km (${origemUsada}) → taxa: R$ ${_totalDisplay.toFixed(2)} |  | frase |
| app.js:5050 | condicional ?: | Com retorno | Com Retorno |  |  |

### Pedidos (comanda)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:12044 | condicional ?: | 🏪 RETIRADA NA LOJA | 🏪 Retirada na Loja |  | caixa alta |
| app.js:12044 | condicional ?: | 🛵 ENTREGA | 🛵 Entrega |  | caixa alta |

### Pedidos (detalhes)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:3731 | texto c/ variável | ${_icone('circle-dollar-sign',16,'btn-ico')}Pagamento recebido | ${_icone('circle-dollar-sign',16,'btn-ico')}Pagamento Recebido |  |  |
| app.js:3732 | texto c/ variável | ${_icone('printer',16,'btn-ico')}Imprimir comanda | ${_icone('printer',16,'btn-ico')}Imprimir Comanda |  |  |

### Pedidos (editar pedido)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:5006 | condicional ?: | Com retorno | Com Retorno |  |  |
| app.js:5060 | condicional ?: | Com retorno | Com Retorno |  |  |

### Pedidos (troca de endereço iFood)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:3562 | texto-html | 📍 Cliente pediu troca de endereço | 📍 Cliente Pediu Troca de Endereço |  |  |
| app.js:3566 | texto c/ variável | ${_icone('check',16,'btn-ico')}Aceitar novo endereço | ${_icone('check',16,'btn-ico')}Aceitar Novo Endereço |  |  |

### Ranking → Clãs

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:10622 | condicional ?: | Ver lojas | Ver Lojas |  |  |
| app.js:10622 | condicional ?: | Ver entregadores | Ver Entregadores |  |  |

### Tabelas de Preço

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:13057 | texto c/ variável | ${_icone('chart-column',16,'btn-ico')}Ver faixas | ${_icone('chart-column',16,'btn-ico')}Ver Faixas |  |  |
| app.js:13067 | texto c/ variável | ${_icone('plus',16,'btn-ico')}Nova faixa | ${_icone('plus',16,'btn-ico')}Nova Faixa |  |  |

### Visão Executiva

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:8349 | texto c/ variável | Hoje é dia de ${_dataComemorativaHoje()} | Hoje É Dia de ${_dataComemorativaHoje()} |  |  |
| app.js:8355 | texto c/ variável | ${_icone('user',16,'btn-ico')}Meu perfil | ${_icone('user',16,'btn-ico')}Meu Perfil |  |  |

### Alocar Motoboy

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:5234 | texto c/ variável | Motoboys disponíveis (${motoboysNoRaio.length}) | Motoboys Disponíveis (${motoboysNoRaio.length}) |  |  |

### Cadastros → Estabelecimentos

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:6013 | title-attr | Financeiro da loja | Financeiro da Loja |  |  |

### Cadastros → Importar lojas

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:5786 | texto c/ variável | ${_icone('download',16,'btn-ico')}Baixar modelo CSV | ${_icone('download',16,'btn-ico')}Baixar Modelo CSV |  |  |

### Clientes (loja)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:13450 | texto-html | Pediram 2x ou mais (30 dias) | Pediram 2x ou Mais (30 dias) | Pediram 2x Ou Mais (30 dias) |  |

### Configuração → iFood

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:12744 | texto c/ variável | ${_icone('scroll-text',16,'btn-ico')}Ver histórico completo | ${_icone('scroll-text',16,'btn-ico')}Ver Histórico Completo |  |  |

### Desempenho

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:8862 | texto c/ variável | ${_icone('search',18)} ${grupo} — detalhamento | ${_icone('search',18)} ${grupo} — Detalhamento |  |  |

### Financeiro da loja

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:10453 | condicional ?: | Ver pedidos | Ver Pedidos |  |  |

### Lojas

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:8922 | title-attr | Financeiro da loja | Financeiro da Loja |  |  |

### Lojas (Nova Loja)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:9114 | texto c/ variável | ❌ Erro Auth: ${auth.error} | ❌ Erro auth: ${auth.error} |  | frase, código sem uso |

### Pedidos (código iFood)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:3633 | texto c/ variável | ✓ ${titulo} — validado | ✓ ${titulo} — Validado |  |  |

### Pedidos (linha do tempo)

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:7674 | texto c/ variável | ⏱️ ${m.duracao} depois do marco anterior | ⏱️ ${m.duracao} Depois do Marco Anterior |  |  |

### Usuários

| arquivo:linha | onde | atual | proposto | só com a sua lista | obs. |
|---|---|---|---|---|---|
| app.js:9698 | texto c/ variável | ❌ Erro Auth: ${auth.error} | ❌ Erro auth: ${auth.error} |  | frase, código sem uso |
