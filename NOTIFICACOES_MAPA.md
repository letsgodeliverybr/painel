# Mapa completo — Notificações e som (app do entregador)

Levantado em 2026-09-03, depois de 3 rodadas de regressão (triplicação de push, som não parando ao aceitar, e agora vibração/moeda não disparando na chegada + loop não persistindo). Objetivo: visão única de tudo que dispara som/vibração/notificação, pra parar de corrigir sintoma por sintoma.

**Este documento é só investigação — nenhum código foi alterado ainda.**

---

## Como ler este mapa

Cada evento tem:
- **Backend**: o que dispara no banco/Edge Function.
- **Dart**: qual handler recebe no app.
- **Esperado**: o que deveria acontecer.
- **Real (código atual)**: o que o código faz de fato hoje, lido linha a linha.
- **Bate?**: ✅ / ❌ / ⚠️ (parcial).

---

## 1. Novo pedido individual disponível

**Backend**: `despacho-engine` (Edge Function, cron a cada 60s) — 3 sub-caminhos: modo "todos" (broadcast simultâneo em 32km), modo "sequencial" (1 entregador por vez, escalando raio/onda), e fallback pós-`tempoReset` (12min, raio 32km desde a correção de 2026-09-02). Todos os 3 chamam `enviarPushFCM()` dentro do próprio `despacho-engine/index.ts` — push **data-only** (`data:{tipo:'novo_pedido', pedido_id, numero}`, sem bloco `notification`).

**Dart — 3 estados do app diferentes**:

| Estado do app | Handler | O que roda |
|---|---|---|
| Killed/background | `_firebaseBackgroundHandler` (main.dart) | `VolumeService.forcarVolumeMidiaMaximo()` → `NotificationService.showNovoPedidoLocal()` |
| Foreground | `FirebaseMessaging.onMessage.listen` (notification_service.dart, `initFCM()`) | `AlertaPedidoService.instance.iniciar()` **+** `showNovoPedidoLocal()` **+** `_abrirTelaPedidosDisponiveis()` |
| App pausado, usuário toca na notificação | `onDidReceiveNotificationResponse` (notification_service.dart) | `AlertaPedidoService.instance.iniciar()` + `_abrirTelaPedidosDisponiveis()` |
| App morto, launch via notificação (tap OU fullScreenIntent) | `AuthGate._resolverTelaSemSetup()` (main.dart), via `getNotificationAppLaunchDetails()` | `AlertaPedidoService.instance.iniciar()` + retorna `PedidosDisponiveisScreen` direto |

**Esperado**: vibração + moeda 5x + loop Let's Go disparam **na chegada** da notificação, independente do app estar aberto ou não; app abre sozinho por cima de qualquer coisa (fullScreenIntent).

**Real (código atual)**:
- **Foreground**: ✅ bate — `iniciar()` roda no `onMessage`, na chegada real, sem depender de toque.
- **Background/killed**: ❌ **NÃO bate** — `_firebaseBackgroundHandler` roda `showNovoPedidoLocal()` (mostra a notificação, com `fullScreenIntent:true` na tag), mas **nunca chama `AlertaPedidoService.instance.iniciar()`**. Motivo documentado no próprio código (comentário em main.dart): esse handler roda num **isolate Dart separado** da UI — `AlertaPedidoService.instance` ali dentro seria uma instância diferente, sem efeito real no app que o usuário vê. A decisão de não chamar de lá foi tomada corretamente do ponto de vista técnico, mas **sem substituir por nenhum outro mecanismo** — resultado: nenhum som/vibração toca até o usuário **tocar manualmente** na notificação (`onDidReceiveNotificationResponse`) ou o app abrir sozinho via fullScreenIntent (`AuthGate`). **Essa é a causa raiz do bug reportado no ponto 1 da Parte 2.**
- **fullScreenIntent não abrindo sozinho** (bug 2): o código Dart (`fullScreenIntent:true` na notificação) e nativo (`setShowWhenLocked`/`setTurnScreenOn` em `MainActivity.kt`) estão presentes e corretos, revisados de novo agora. A causa mais provável é a combinação: (a) a permissão especial `USE_FULL_SCREEN_INTENT` genuinamente não concedida no aparelho de teste — não temos como confirmar isso remotamente — e (b) como consequência direta do bug acima, mesmo que a permissão estivesse concedida, o **som nunca tocaria de qualquer forma** enquanto o app está fechado, o que pode estar sendo confundido/misturado com "não abre sozinho" no teste. São dois sintomas do mesmo buraco: nada de custom acontece em background além do que `showNovoPedidoLocal()` já faz sozinha.

**Bate?** ⚠️ Parcial — só funciona certo com o app já em foreground.

---

## 2. Rota agrupada (Roterizador automático, "Rota dispatch")

**Backend**: `despacho-engine`, mesmo arquivo, loop separado ("Rota dispatch", mode-independent — roda pra rota agrupada pronta, sem checar modo "todos"/"sequencial"). Chama o mesmo `enviarPushFCM()`, mas com `tipo` implícito — checando o código, esse caminho **também sempre usa `tipo:'novo_pedido'`** no payload de dados (não `'nova_rota'`), porque `enviarPushFCM()` tem esse valor fixo na função (`data: { tipo: "novo_pedido", ... }`, sempre, não diferencia rota agrupada de pedido individual).

**Dart**: mesmos handlers da seção 1 (é o mesmo `tipo:'novo_pedido'` chegando).

**Esperado**: idem seção 1.

**Real**: mesmo comportamento/bug da seção 1 (background morto = mudo). Achado extra: o payload nunca diz `'nova_rota'` pra esse caminho — só existe diferenciação de `'nova_rota'` no `notify-novo-pedido` (Edge Function separada, hoje **inatingível**, ver seção 5) e no trigger `fn_intercept_realocacao_manual` (não usa FCM, só Realtime — ver seção 4). Ou seja, hoje **nenhuma rota agrupada despachada pelo despacho-engine gera um push distinto de "nova rota"** — sempre chega como pedido comum. Não é um bug funcional grave (o app ainda abre a tela certa), mas é uma inconsistência de rótulo.

**Bate?** ⚠️ Parcial — mesmo bug da seção 1, mais a inconsistência de tipo.

---

## 3. Convite direto de Rota (Roterizador manual, `entregadores.notificacao_rota`)

**Backend**: `app.js` (painel), 2 pontos (linhas ~10321 e ~10399) fazem `PATCH entregadores SET notificacao_rota=rota.id` diretamente — uma ação manual do admin atribuindo um entregador específico a uma rota. **Não existe trigger nenhum na tabela `entregadores`** (confirmado: `information_schema.triggers` não retorna nada pra essa tabela) — **não dispara FCM nenhum**, só a mudança de coluna.

**Dart**: `entregador_home_screen.dart`, `_assinarRealtimeRota()` — canal Supabase Realtime assinando `UPDATE` em `entregadores` (coluna `notificacao_rota`). Só funciona se o app tiver uma conexão WebSocket ativa no momento — **não tem fallback de push nenhum**.

**Esperado**: vibração + som + o card aparecer na Home.

**Real**:
- Card aparece, `AlertaPedidoService.instance.iniciar()` é chamado corretamente (já corrigido na consolidação de hoje) — vibra + 5x moeda + loop, tudo certo **enquanto o app estiver com Realtime conectado** (foreground, ou background recente com engine ainda viva).
- Achado: `entregador_home_screen.dart:622` — tocar no card pra **abrir** os detalhes da rota (`_buildCardRota().onTap`) chama `AlertaPedidoService.instance.parar()` **antes mesmo de decidir aceitar ou recusar**. Isso é uma sobra da consolidação de hoje, pensada pro modelo antigo (som de 10x finito, fazia sentido calar ao abrir) — no modelo novo (loop contínuo até decisão), isso para o som prematuramente só por ter *olhado* o convite, contrariando exatamente o comportamento pedido no bug 3 da Parte 2 ("enquanto tiver pedido disponível, o loop deveria continuar"). **Bug real, achado nesta auditoria.**
- App morto/sem WebSocket: convite **nunca chega** — limitação estrutural (sem push nenhum), fora do escopo dos bugs reportados agora, mas registrado.

**Bate?** ❌ — some antes da hora ao abrir o card (bug novo achado); além disso zero alcance com app fechado (limitação pré-existente, não hoje reportada mas relevante).

---

## 4. Pedido realocado manualmente (admin reatribui pra outro entregador)

**Backend**: trigger `tg_intercept_realocacao_manual` → `fn_intercept_realocacao_manual()` (BEFORE UPDATE em `pedidos`) — dispara quando `motoboy_id`/`entregador_id` muda pra um valor novo, e o pedido **não** estava em `status='pronto'` antes (ou seja, já tinha sido aceito por alguém, e o admin move pra outro entregador). Insere uma linha nova em `despacho_fila` (`status:'aguardando', onda:1, expira_em:+30s`) pro **novo** entregador, e reseta o pedido pra `status:'pronto'`/`motoboy_id:null` (a "realocação" na prática recria uma oferta pendente, não força atribuição direta).

**Dart**: nenhum — essa INSERT em `despacho_fila` **não dispara push nenhum hoje**.

**Esperado**: o novo entregador recebe a oferta com vibração/som/abertura de tela, igual um pedido normal.

**Real**: **❌ Regressão direta causada pela minha própria correção de hoje.** Até a correção da triplicação de push (mais cedo nesta sessão), essa INSERT disparava o trigger `tg_despacho_fila_notify` → `notify-novo-pedido` (com `entregador_id`), que notificava esse entregador especificamente. Removi esse trigger junto com o resto (pra matar a duplicação vinda do `despacho-engine`), sem perceber que ele era **a única fonte de notificação** pra esse caminho específico — `despacho-engine` não participa dessa realocação manual nenhuma (é 100% via trigger SQL direto). Resultado: hoje, realocação manual cria a entrada em `despacho_fila` mas **o novo entregador nunca é avisado** (nem toque, nem som — só veria se abrisse o app e desse refresh na tela Disponíveis por conta própria).

**Bate?** ❌ — regressão, precisa de fonte de notificação própria (não pode reusar `notify-novo-pedido` como estava, porque aquele formato bloqueia o fullScreenIntent/som customizado em background — mesmo problema da seção 1).

---

## 5. `notify-novo-pedido` (Edge Function) — hoje morta

**Backend**: função ainda existe e está deployada (`ACTIVE`, última atualização 2026-07-17), mas **nenhum trigger a chama mais** — confirmado via busca em `pg_proc` por `notify-novo-pedido`: zero funções restantes referenciam essa URL. Só ficou como código órfão.

**Dart**: N/A — nunca mais é alcançada.

**Bate?** N/A — não é mais parte do fluxo ativo. Decisão de manter o código (não deletar a função) foi deliberada, pra reversibilidade — mas vale reconsiderar se algum caminho (como a seção 4) deveria voltar a usá-la, ou se um mecanismo novo e mais simples (data-only, sem bloco `notification`) é melhor.

---

## 6. Pedido cancelado (enquanto ainda 'aguardando' pra 1+ entregadores)

**Backend**: `alterarStatusPedidoRelatorio()` (app.js) faz um `PATCH pedidos SET status='cancelado'` simples — **não toca em `despacho_fila` de jeito nenhum**. Não existe trigger nenhum em `pedidos` que reaja a `status` virando `'cancelado'` e limpe `despacho_fila` (confirmado: nenhuma função no banco referencia `despacho_fila` além de `fn_notify_pedido_pronto` — leitura, não escrita — e `fn_intercept_realocacao_manual`, que só insere, nunca expira).

**Dart**: `pedidos_disponiveis_screen.dart`, `_assinarRealtime()` (canal `pedidos-disp-realtime`, **sem filtro** — escuta TODOS os pedidos do sistema) — no UPDATE, se `status != 'pronto'`, remove da lista visual `_pedidos`. **Só isso.** Não toca em `despacho_fila`, não chama `AlertaPedidoService.instance.parar()` — e só existe enquanto essa tela específica está montada.

**Esperado** (Parte 2, bug 4): loop para imediatamente quando o pedido é cancelado.

**Real**: ❌ **Confirmado, é exatamente o bug reportado.** `despacho_fila.status` continua `'aguardando'` pra sempre (até o timeout natural de `tempoReset`, até 12 minutos depois de `pronto_em`) — `AlertaPedidoService._reavaliarSeDeveContinuar()` só reage a mudanças em `despacho_fila`, e como nada muda ali, o loop nunca é avisado. Mesmo NA tela Disponíveis, o pedido some da lista visual (via o listener acima) mas **o som continua tocando**, porque a lista visual e o estado do som são dois sistemas desconectados hoje.

**Bate?** ❌.

---

## 7. Pedido aceito por OUTRO entregador (achado não reportado, mesma causa raiz da seção 6)

**Backend**: quando entregador Y aceita, o client faz `PATCH pedidos SET status='aceito', motoboy_id=Y ...`. Isso **também não limpa `despacho_fila`** pros OUTROS entregadores que tinham recebido a mesma oferta (broadcast "todos" manda pra vários de uma vez — só 1 aceita, os outros ficam com a linha 'aguardando' intacta). O único lugar que já expirava isso era o topo do loop do `despacho-engine` (`pedidoAtual.status !== "pronto" → expira`) — mas esse check só roda pra pedidos que **ainda estavam na query inicial do tick** (`.eq("status","pronto")`); uma vez aceito, o pedido some dessa query pra sempre, então esse "expira" nunca dispara de novo em ticks futuros — só cobre a janela estreita de corrida dentro do MESMO tick.

**Dart**: idem seção 6 — `_assinarRealtime()` remove da lista visual quando vê a mudança de status em `pedidos` (tela Disponíveis, se estiver montada), mas não mexe em `despacho_fila`/som.

**Esperado**: quando outro entregador aceita, os demais que tinham a oferta pendente param de tocar o loop.

**Real**: ❌ **Mesmo buraco da seção 6, não reportado ainda mas com o mesmo impacto** — na prática, todo entregador que recebeu uma oferta "todos" e NÃO foi o que aceitou continua com o loop tocando por até 12 minutos (`tempoReset`) depois que o pedido já foi pra outra pessoa, até `expira_em` (ancorado em `pronto_em+tempoReset` desde a correção de hoje) finalmente bater e `despacho-engine` marcar como expirado no próximo tick.

**Bate?** ❌ — mesma causa raiz da seção 6, merece o mesmo fix (ver Parte 3 proposta).

---

## 8. Loop persistindo enquanto há pedido disponível (bug 3, Parte 2)

Investigado à parte — não é um evento novo, é sobre o comportamento de `AlertaPedidoService.iniciar()` já ativo. O design (`LoopMode.one` depois das 5 moedas) já É contínuo por natureza — não deveria "tocar 1 vez e parar" sozinho. As causas prováveis do sintoma relatado, cruzando com o resto do mapa:

1. **Se o teste foi com app fechado/bloqueado**: bate com a seção 1 — o loop nunca chega a **começar de verdade** (só o heads-up mudo aparece), então parece "tocou 1 vez" quando na real nunca tocou nada, e ao abrir manualmente (tap) o loop então SIM começa — mas se nesse meio tempo `_reavaliarSeDeveContinuar()` já achou que não tinha mais nada "aguardando" (ex: expirou por outro motivo), o loop já nasce morto.
2. **Convite de rota (seção 3)**: `.parar()` prematuro ao só abrir o card — se isso for o cenário testado, explica sozinho.
3. Não achei nenhum outro `.parar()` incorreto no restante do código (conferido: todos os 5 call sites de `.parar()` fazem sentido nos seus contextos — aceite normal, aceite de rota, timeout de 60s do convite de rota, e o achado acima do item 622).

**Bate?** Depende do cenário exato testado — mas as causas 1 e 2 acima já cobrem os cenários mais prováveis, sem precisar de um bug novo e desconhecido.

---

## Resumo — bugs confirmados nesta auditoria (pra decidir prioridade na Parte 3)

| # | Bug | Causa raiz | Onde mexer |
|---|---|---|---|
| 1 | Vibração/moeda não disparam na chegada (app fechado) | `_firebaseBackgroundHandler` nunca aciona `AlertaPedidoService` (isolate separado) | main.dart / novo mecanismo de som em background |
| 2 | App não abre sozinho | Consequência do #1 + possível permissão não concedida no aparelho (não verificável remotamente) | depende de teste no device + #1 |
| 3 | Loop não persiste | Maior parte explicada por #1 e pelo achado abaixo (#3b) | — |
| 3b | `.parar()` prematuro ao abrir card de convite de rota | `entregador_home_screen.dart:622` | remover/mover esse `.parar()` |
| 4a | Loop não para ao cancelar pedido | `despacho_fila` nunca é limpo no cancelamento | trigger novo em `pedidos` |
| 4b | Loop não para quando outro entregador aceita (não reportado, mesma causa) | idem 4a | mesmo trigger, escopo mais amplo |
| 5 | Realocação manual não notifica ninguém | Regressão da correção de triplicação de hoje (removi a única fonte de push desse caminho) | precisa de fonte de push própria pra esse trigger, sem reintroduzir o notification-block problemático |

---

## Parte 3 — aplicado em 2026-09-03

- **#1**: `_tocarAlertaChegada()` novo em `main.dart` — vibração + moeda 5x direto no isolate de background, na chegada (AudioPlayer avulso, não o singleton). Loop contínuo continua só iniciando quando o app abre de verdade.
- **#2**: não verificável remotamente — depende de confirmar no aparelho de teste se a permissão está concedida (`FullScreenIntentPermissionService.isGranted()`); código nativo/Dart revisado de novo, sem achado de bug adicional.
- **#3/#3b**: `.parar()` prematuro removido de `entregador_home_screen.dart` (abrir o card de convite de rota não para mais o loop).
- **#4a/#4b**: trigger único `tg_expirar_despacho_fila_pedido_nao_pronto` (`migrations/trigger_unificado_expirar_despacho_fila.sql`) — expira toda `despacho_fila` 'aguardando' de um pedido que sai de 'pronto', exceto a linha de quem acabou de ser atribuído. Testado atomicamente (transação com ROLLBACK, zero pegada no banco): cancelamento e aceite por outro entregador confirmados.
- **#5**: nova Edge Function dedicada `notify-pedido-realocado` (data-only, mesmo padrão do despacho-engine) chamada só por `fn_intercept_realocacao_manual` (`migrations/notificar_realocacao_manual.sql`) — escopada a esse único trigger, não um disparo genérico em `despacho_fila` (evita reintroduzir a triplicação).

**Proposta de unificação pra Parte 3** (não implementada ainda): um único trigger `AFTER UPDATE ON pedidos`, disparando sempre que `status` sai de `'pronto'` (pra `'aceito'`, `'cancelado'`, ou qualquer outro), que expira **todas** as linhas `'aguardando'` de `despacho_fila` pra esse `pedido_id` — resolve #4a e #4b de uma vez, com uma peça de lógica só, ao invés de espalhar limpeza em cada fluxo de aceite/cancelamento no client.
