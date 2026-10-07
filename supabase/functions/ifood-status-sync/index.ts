import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const IFOOD_CLIENT_ID = Deno.env.get("IFOOD_CLIENT_ID") ?? "";
const IFOOD_CLIENT_SECRET = Deno.env.get("IFOOD_CLIENT_SECRET") ?? "";
const IFOOD_BASE_URL = "https://merchant-api.ifood.com.br";
const MAX_TENTATIVAS = 5;

async function logErro(fonte: string, detalhes: Record<string, unknown>) {
  const { error } = await supabase.from("logs_acoes").insert({
    acao: `ifood_erro_${fonte}`,
    detalhes,
  });
  if (error) {
    console.error(`[ifood-status-sync] FALHA AO GRAVAR LOG DE ERRO (${fonte}):`, error.message, detalhes);
  }
}

// Item 16 do checklist de homologação: respeitar rate limit. Mesmo helper
// de ifood-polling, duplicado aqui. Confirmado contra a doc pública do
// iFood (Rate limit, 2026-09-07): 429 vem com header Retry-After
// (segundos). Vira log dedicado (searchável separado dos outros erros
// HTTP) e sinaliza pro chamador parar de insistir nessa rodada.
function retryAfterSec(res: Response): number | null {
  const ra = res.headers.get("Retry-After");
  if (!ra) return null;
  const n = Number(ra);
  return Number.isFinite(n) ? n : null;
}
async function logSeRateLimited(fonte: string, res: Response): Promise<boolean> {
  if (res.status !== 429) return false;
  await logErro(`rate_limit_${fonte}`, { retryAfterSec: retryAfterSec(res) });
  return true;
}

async function upsertConfig(chave: string, valor: string) {
  const { data, error: selErr } = await supabase.from("configuracoes").select("chave").eq("chave", chave).limit(1);
  if (selErr) { await logErro("config_ler", { chave, message: selErr.message }); return; }
  const { error: writeErr } = (data && data.length > 0)
    ? await supabase.from("configuracoes").update({ valor }).eq("chave", chave)
    : await supabase.from("configuracoes").insert({ chave, valor });
  if (writeErr) await logErro("config_gravar", { chave, message: writeErr.message });
}

// Mesmo cache de token usado em ifood-polling (functions do Supabase são
// isoladas por deploy; duplicar esse helper segue o mesmo padrão já usado
// no resto do projeto — nenhuma outra function daqui compartilha módulo).
async function getAccessToken(): Promise<string | null> {
  const { data: cfg, error: cfgErr } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["ifood_access_token", "ifood_token_expires_at"]);
  if (cfgErr) await logErro("auth_ler_cache", { message: cfgErr.message });

  const cache: Record<string, string> = {};
  for (const c of cfg || []) cache[c.chave] = c.valor;

  const expiraEm = cache["ifood_token_expires_at"] ? new Date(cache["ifood_token_expires_at"]) : null;
  const aindaValido = !!expiraEm && expiraEm.getTime() - Date.now() > 5 * 60 * 1000;
  if (aindaValido && cache["ifood_access_token"]) return cache["ifood_access_token"];

  if (!IFOOD_CLIENT_ID || !IFOOD_CLIENT_SECRET) {
    await logErro("auth_credenciais_ausentes", { temClientId: !!IFOOD_CLIENT_ID, temClientSecret: !!IFOOD_CLIENT_SECRET });
    return null;
  }

  try {
    const res = await fetch(`${IFOOD_BASE_URL}/authentication/v1.0/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grantType: "client_credentials",
        clientId: IFOOD_CLIENT_ID,
        clientSecret: IFOOD_CLIENT_SECRET,
      }),
    });

    if (await logSeRateLimited("auth", res)) return null;
    const bodyText = await res.text();
    if (!res.ok) {
      await logErro("auth_http", { status: res.status, body: bodyText });
      return null;
    }

    let json: any;
    try { json = JSON.parse(bodyText); } catch (e) {
      await logErro("auth_parse", { message: String(e), body: bodyText });
      return null;
    }

    const token = json.accessToken ?? json.access_token;
    const expiresInSec = json.expiresIn ?? json.expires_in ?? 21600;
    if (!token) {
      await logErro("auth_resposta_sem_token", { body: bodyText });
      return null;
    }

    await upsertConfig("ifood_access_token", token);
    await upsertConfig("ifood_token_expires_at", new Date(Date.now() + expiresInSec * 1000).toISOString());
    return token;
  } catch (e) {
    await logErro("auth_excecao", { message: String(e) });
    return null;
  }
}

// Confirmado contra a doc autenticada do Portal do Desenvolvedor iFood
// (Logistics API v1.0, 2026-08-19): servidor base
// https://merchant-api.ifood.com.br/logistics/v1.0, eventos POST
// /orders/{id}/{assignDriver|goingToOrigin|arrivedAtOrigin|dispatch|arrivedAtDestination}.
// O bug real era a falta do "/v1.0" no meio do path (a reconstrução por
// pesquisa pública anterior tinha os nomes de evento certos, só faltava a
// versão) — é o que causava o 404 visto em produção.
function endpointParaEvento(ifoodOrderId: string, evento: string): string {
  return `/logistics/v1.0/orders/${ifoodOrderId}/${evento}`;
}

// Bug real corrigido aqui (2026-09-16): assignDriver, diferente dos outros
// 4 eventos de logística, EXIGE corpo — sem isso o iFood recusa com 400
// "No request body", travando a cadeia inteira de confirmação (o pedido
// nunca sai de "sem confirmação do merchant" e verifyDeliveryCode nunca é
// aceito). Payload confirmado contra a doc pública do iFood (Logistics
// API, 2026-09-16): workerName, workerPhone, workerVehicleType (enum
// BICYCLE|ONFOOT|PATINETE|EBIKE|SUPERBIKE|CAR|MOTORCYCLE|MOTORBIKE).
function mapearVeiculoIfood(modal: string | null | undefined): string {
  switch (modal) {
    case "bicicleta": return "BICYCLE";
    case "carro": return "CAR";
    default: return "MOTORCYCLE";
  }
}

// null = pedido sem entregador alocado (ex: desalocado entre a fila e o
// envio, caso do #9120); undefined = falha ao ler o banco.
async function montarCorpoAssignDriver(pedidoId: string): Promise<string | null | undefined> {
  const { data: pedido, error: pedidoErr } = await supabase
    .from("pedidos").select("motoboy_id, entregador_id").eq("id", pedidoId).maybeSingle();
  if (pedidoErr) { await logErro("assign_driver_buscar_pedido", { pedidoId, message: pedidoErr.message }); return undefined; }
  const entregadorId = pedido?.motoboy_id ?? pedido?.entregador_id ?? null;
  if (!entregadorId) return null;
  const { data: entregador, error: entErr } = await supabase
    .from("entregadores").select("nome, telefone, modal_veiculo").eq("id", entregadorId).maybeSingle();
  if (entErr) { await logErro("assign_driver_buscar_entregador", { pedidoId, entregadorId, message: entErr.message }); return undefined; }
  return JSON.stringify({
    workerName: entregador?.nome || "Entregador",
    workerPhone: (entregador?.telefone || "").replace(/\D/g, ""),
    workerVehicleType: mapearVeiculoIfood(entregador?.modal_veiculo),
  });
}

// ═══════════════════════════════════════════════
// WEBHOOK INBOUND — eventos que o iFood empurra (push), alternativa ao
// polling de ifood-polling pra receber pedidos/mudanças de status.
// Confirmado contra a doc oficial (2026-07-25):
// https://developer.ifood.com.br/en-US/docs/guides/order/events/delivery-methods/webhook/signature/
// Header X-IFood-Signature = HMAC-SHA256(client_secret, raw body bytes),
// hex. client_secret usado direto como chave — mesmo credential do OAuth.
// ═══════════════════════════════════════════════

// Comparação em tempo constante — Deno não tem crypto.timingSafeEqual como
// o Node, implementado na mão pra não vazar timing na comparação da
// assinatura (a doc do iFood é explícita: eles mandam assinaturas erradas
// de propósito durante homologação, testando se a validação é robusta).
function compararConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function validarAssinaturaWebhook(rawBody: Uint8Array, assinaturaRecebida: string): Promise<boolean> {
  if (!IFOOD_CLIENT_SECRET || !assinaturaRecebida) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(IFOOD_CLIENT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinaturaCalculada = await crypto.subtle.sign("HMAC", key, rawBody);
  const hex = Array.from(new Uint8Array(assinaturaCalculada)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return compararConstante(hex, assinaturaRecebida.toLowerCase());
}

// merchant.address não existe no payload do iFood (confirmado contra pedido
// de teste real, 2026-07-25 — merchant só tem id/name) — a única fonte
// confiável de endereço/coordenadas da loja é o nosso próprio cadastro,
// resolvido via merchant.id -> lojas.ifood_merchant_id (ver migração
// add_ifood_merchant_id_lojas.sql). loja_id do pedido também vem daqui —
// antes disso, pedidos do iFood eram gravados SEM loja_id nenhum.
async function buscarLojaPorMerchantId(merchantId: string | null | undefined) {
  if (!merchantId) return null;
  const { data, error } = await supabase
    .from("lojas")
    .select("id, nome, endereco, latitude, longitude")
    .eq("ifood_merchant_id", merchantId)
    .limit(1);
  if (error) { await logErro("buscar_loja_merchant_id", { merchantId, message: error.message }); return null; }
  return data && data[0] ? data[0] : null;
}

// Mesmo mapeamento usado em ifood-polling, duplicado aqui — cada Edge
// Function é um deploy isolado, sem módulo compartilhado entre elas, mesmo
// padrão já usado no resto do projeto. Campos confirmados contra um pedido
// de teste real do Developer Portal do iFood (2026-07-25).
// payments/benefits/customer.documentNumber confirmados contra a doc
// pública do iFood (Order Details / Order events, 2026-09-07) — vinham na
// resposta de /order/v1.0/orders/{id} e eram descartados até aqui. Mesma
// extração usada em ifood-polling, duplicada aqui pelo mesmo motivo do
// resto do arquivo (nenhuma function compartilha módulo).
// iFood manda o método em inglês (Order API pública, 2026-09-16: CREDIT,
// DEBIT, MEAL_VOUCHER, FOOD_VOUCHER, CASH, PIX, OTHER) — traduzido pro
// vocabulário da constraint pedidos_forma_pagamento_check
// (dinheiro/cartao/pix/outro). Mesmo helper de ifood-polling, duplicado
// aqui pelo mesmo motivo do resto do arquivo.
function mapearFormaPagamento(metodo: string | null): string {
  switch (metodo) {
    case "CASH": return "dinheiro";
    case "PIX": return "pix";
    case "CREDIT":
    case "DEBIT":
    case "MEAL_VOUCHER":
    case "FOOD_VOUCHER": return "cartao";
    default: return "outro";
  }
}
function extrairPagamento(d: any) {
  const metodo = d.payments?.methods?.[0] ?? null;
  return {
    forma_pagamento: mapearFormaPagamento(metodo?.method ?? metodo?.type ?? null),
    bandeira_cartao: metodo?.card?.brand ?? null,
    troco_para: metodo?.cash?.changeFor ?? null,
  };
}
function extrairCupom(d: any) {
  const benefits = Array.isArray(d.benefits) ? d.benefits : null;
  if (!benefits || benefits.length === 0) return { cupom_valor: null, cupom_detalhes: null };
  const total = benefits.reduce((soma: number, b: any) => soma + (Number(b?.value) || 0), 0);
  return { cupom_valor: total, cupom_detalhes: benefits };
}

// Mesmo padrão de formatarBrasiliaNaive() do despacho-engine — timestamp
// SEM fuso, mas representando hora de Brasília (não UTC). Bug real
// corrigido aqui (2026-09-16): antes usava new Date().toISOString(), que
// grava UTC puro numa coluna timestamp SEM fuso — o valor ficava lido como
// se já fosse Brasília, adiantando o pedido em 3h (created_at/pronto_em no
// futuro em relação ao relógio real), o que também distorcia o cálculo de
// timeout/escalada de onda do despacho-engine pra pedidos do iFood. Sem
// horário de verão em Brasília desde 2019 — offset fixo de -3h.
function agoraBrasiliaNaive(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().replace("Z", "");
}

// Bug real corrigido aqui (2026-09-16): pedido do iFood entrava direto
// como 'pronto', pulando o fluxo que todo pedido próprio segue (recebido
// -> loja marca pronto) — despacho automático saía cedo demais e a loja
// nunca via o pedido "chegando". Replica a mesma decisão de criarPedido()
// no painel (app.js): sem agendamento -> 'recebido' (o evento RTP,
// tratado em processarEventoWebhook, promove pra 'pronto' depois — mesmo
// papel de "loja clica em pronto"); orderTiming SCHEDULED -> 'agendado' +
// agendado_para (timestamptz REAL — o iFood já manda em UTC de verdade,
// não passa por agoraBrasiliaNaive, mesmo tratamento que criarPedido/
// salvarEdicaoPedido já dão a essa coluna no painel). _runScheduler()
// (app.js) já promove qualquer agendado->pronto na hora certa, de
// qualquer origem — nenhuma mudança necessária ali. Mesma lógica de
// ifood-polling, duplicada aqui.
function statusInicialIfood(d: any): { status: string; agendadoPara: string | null } {
  const schedule = d.schedule ?? d.scheduled ?? null;
  const agendado = d.orderTiming === "SCHEDULED" && !!schedule?.deliveryDateTimeStart;
  return {
    status: agendado ? "agendado" : "recebido",
    agendadoPara: agendado ? schedule.deliveryDateTimeStart : null,
  };
}

async function mapearPedidoIfood(d: any) {
  const agora = agoraBrasiliaNaive();
  const merchantId = d.merchant?.id ?? null;
  const loja = await buscarLojaPorMerchantId(merchantId);
  if (!loja) await logErro("merchant_id_sem_loja_correspondente", { merchantId, merchantName: d.merchant?.name ?? null });
  const pagamento = extrairPagamento(d);
  const cupom = extrairCupom(d);
  const { status: statusInicial, agendadoPara } = statusInicialIfood(d);
  // Mesmo fix de ifood-polling/index.ts (ver comentário lá, 2026-09-19) —
  // pagamento_confirmado/valor/com_retorno lidos de payments.pending, não
  // presumidos sempre pago online.
  const pendente = d.payments?.pending ?? 0;
  return {
    ifood_order_id: d.id ?? d.orderId,
    numero: String(d.displayId ?? d.id),
    numero_loja: String(d.displayId ?? d.id),
    origem: "ifood",
    status: statusInicial,
    status_detalhado: statusInicial,
    agendado_para: agendadoPara,
    pagamento_confirmado: pendente <= 0,
    com_retorno: pendente > 0,
    loja_id: loja?.id ?? null,
    retirada: d.orderType === "TAKEOUT",
    endereco: d.delivery?.deliveryAddress?.formattedAddress ?? "",
    latitude: d.delivery?.deliveryAddress?.coordinates?.latitude ?? null,
    longitude: d.delivery?.deliveryAddress?.coordinates?.longitude ?? null,
    endereco_coleta: loja?.endereco ?? "",
    latitude_coleta: loja?.latitude ?? null,
    longitude_coleta: loja?.longitude ?? null,
    contato_coleta: loja?.nome ?? d.merchant?.name ?? null,
    cliente: d.customer?.name ?? "",
    telefone: d.customer?.phone?.number ?? null,
    cliente_documento: d.customer?.documentNumber ?? null,
    ifood_pickup_code: d.pickupCode ?? null,
    // Código de 8 dígitos do portal confirmacao-entrega-propria.ifood.com.br
    // — confirmado (2026-09-17) que existe independente do telefone ser
    // real ou o 0800 genérico do sandbox (campos separados dentro de
    // customer.phone). Ver entrega_screen.dart/IfoodConfirmacaoWebviewScreen.
    ifood_phone_localizer: d.customer?.phone?.localizer ?? null,
    ifood_phone_localizer_expiration: d.customer?.phone?.localizerExpiration ?? null,
    itens: d.items ?? [],
    valor: pendente,
    total_pedido: d.total?.orderAmount ?? 0,
    taxa_entrega: d.total?.deliveryFee ?? 0,
    ...pagamento,
    ...cupom,
    recebido_em: statusInicial === "recebido" ? agora : null,
    pronto_em: null,
    created_at: agora,
    updated_at: agora,
  };
}

async function buscarDetalhesPedidoWebhook(orderId: string, token: string) {
  const res = await fetch(`${IFOOD_BASE_URL}/order/v1.0/orders/${orderId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (await logSeRateLimited("webhook_detalhes_pedido", res)) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    await logErro("webhook_detalhes_pedido_http", { orderId, status: res.status, body });
    return null;
  }
  try {
    return await res.json();
  } catch (e) {
    await logErro("webhook_detalhes_pedido_parse", { orderId, message: String(e) });
    return null;
  }
}

// Códigos de evento confirmados contra a doc pública do iFood (Order
// events / Shipping "Entrega Fácil", 2026-09-07): PLC=PLACED,
// CFM=CONFIRMED, SPS=SEPARATION_STARTED, SPE=SEPARATION_ENDED,
// RTP=READY_TO_PICKUP, DSP=DISPATCHED, CON=CONCLUDED, CAN=CANCELLED,
// DAR=DELIVERY_ADDRESS_CHANGE_REQUESTED (metadata.address com o endereço
// novo; 15min corridos pra aceitar/rejeitar), DDCR=DELIVERY_DROP_CODE_
// REQUESTED (o pedido exige código de confirmação na entrega; o evento NÃO
// traz o código, ver registrarDdcr). Mesma lógica de ifood-polling,
// duplicada aqui.
//
// Bug real corrigido aqui: `ignoreDuplicates:true` fazia ON CONFLICT DO
// NOTHING — pra um ifood_order_id que já existe na tabela, cancelamento
// pelo cliente/iFood ou conclusão por outro app (Gestor de Pedidos) era
// descartado sem efeito nenhum. Um evento de webhook = uma mudança de
// status (ou pedido novo): pedido novo entra pelo fluxo de sempre; pedido
// já existente só é tocado se o evento for CAN, CON, RTP, DAR ou DDCR —
// qualquer outro evento é só confirmado (202), sem sobrescrever progresso
// interno (em_rota/chegou_destino etc., escrito pelo app do entregador).
// Lança exceção em qualquer falha real (não em "evento sem orderId", que é
// esperado pra presence events) — o chamador decide se isso vira 5xx
// (retry do iFood).
async function processarEventoWebhook(evento: any): Promise<void> {
  const code = evento?.code ?? evento?.fullCode ?? null;
  // Evento de presença (KEEPALIVE, a cada ~30s e no "testar conexão" do
  // portal): não é de pedido — só confirma (202), sem log e sem chamar a API.
  // Antes o id do EVENTO virava "orderId", a busca do pedido falhava e o
  // webhook respondia 500 (o iFood reenvia por até 15 min).
  if (code === "KEEPALIVE") return;
  const orderId = evento?.orderId;
  if (!orderId) {
    await logErro("webhook_evento_sem_orderId", { evento });
    return;
  }
  const metadata = evento?.metadata;

  const { data: existente, error: existeErr } = await supabase
    .from("pedidos")
    .select("id, status")
    .eq("ifood_order_id", orderId)
    .limit(1);
  if (existeErr) throw new Error(`falha ao checar pedido existente ${orderId}: ${existeErr.message}`);

  if (existente && existente[0]) {
    const atual = existente[0] as { id: string; status: string | null };
    if (code === "CAN" && atual.status !== "cancelado") {
      const { error } = await supabase.from("pedidos").update({
        status: "cancelado", status_detalhado: "cancelado", updated_at: agoraBrasiliaNaive(),
      }).eq("id", atual.id);
      if (error) throw new Error(`falha ao cancelar pedido ${orderId}: ${error.message}`);
    } else if (code === "CON" && atual.status !== "cancelado" && atual.status !== "finalizado") {
      const { error } = await supabase.from("pedidos").update({
        status: "finalizado", status_detalhado: "finalizado", updated_at: agoraBrasiliaNaive(),
      }).eq("id", atual.id);
      if (error) throw new Error(`falha ao concluir pedido ${orderId}: ${error.message}`);
    } else if (code === "RTP" && atual.status !== "cancelado" && atual.status !== "finalizado") {
      // READY_TO_PICKUP — mesmo papel de "loja clica em Marcar como
      // pronto" nos pedidos próprios. Só isso libera o pedido pro
      // despacho-engine (que só olha status='pronto').
      const agora = agoraBrasiliaNaive();
      const { error } = await supabase.from("pedidos").update({
        status: "pronto", status_detalhado: "pronto", pronto_em: agora, updated_at: agora,
      }).eq("id", atual.id);
      if (error) throw new Error(`falha ao marcar pedido pronto ${orderId}: ${error.message}`);
    } else if (code === "DAR" && metadata?.address) {
      const { error } = await supabase.from("pedidos").update({
        troca_endereco_novo: metadata.address, troca_endereco_solicitada_em: new Date().toISOString(),
      }).eq("id", atual.id);
      if (error) throw new Error(`falha ao registrar troca de endereço ${orderId}: ${error.message}`);
    } else if (code === "REQUEST_DRIVER_SUCCESS" || code === "REQUEST_DRIVER_FAILED") {
      // Mesmo tratamento de ifood-polling/index.ts (ver comentário lá) —
      // confirmação assíncrona do módulo Shipping, chega pelo webhook aqui
      // ou pelo polling, o que vier primeiro.
      const novoStatus = code === "REQUEST_DRIVER_SUCCESS" ? "sucesso" : "falha";
      const { error } = await supabase.from("pedidos").update({
        ifood_shipping_status: novoStatus, ifood_shipping_atualizado_em: new Date().toISOString(),
      }).eq("id", atual.id);
      if (error) throw new Error(`falha ao atualizar ifood_shipping_status ${orderId}: ${error.message}`);
    }
    return;
  }

  const token = await getAccessToken();
  if (!token) throw new Error("sem token de acesso pra buscar detalhes do pedido");

  const detalhes = await buscarDetalhesPedidoWebhook(orderId, token);
  if (!detalhes) throw new Error(`falha ao buscar detalhes do pedido ${orderId}`);

  const pedido = await mapearPedidoIfood(detalhes);
  const { error } = await supabase.from("pedidos").upsert(pedido, { onConflict: "ifood_order_id" });
  if (error) {
    await logErro("webhook_persistir_pedido", { orderId, message: error.message });
    throw new Error(`falha ao persistir pedido ${orderId}: ${error.message}`);
  }
}

// Confirmação automática do pedido no iFood — mesma regra de
// ifood-polling/index.ts (ver comentário lá, 2026-09-30), duplicada aqui
// pelo mesmo motivo do resto do arquivo. Pelo webhook, falha que vale
// tentar de novo (429, 5xx, exceção) vira exceção → 500 → o iFood reenvia.
function ehEvento(code: string | null, curto: string, longo: string): boolean {
  return code === curto || code === longo;
}

async function marcarConfirmado(orderId: string): Promise<void> {
  const { error } = await supabase.from("pedidos")
    .update({ ifood_confirmado_em: new Date().toISOString() })
    .eq("ifood_order_id", orderId).is("ifood_confirmado_em", null);
  if (error) throw new Error(`falha ao marcar pedido confirmado ${orderId}: ${error.message}`);
}

async function confirmarPedidoSeNecessario(orderId: string, cfmNoLote: boolean): Promise<void> {
  if (cfmNoLote) return;
  const { data, error } = await supabase
    .from("pedidos").select("id, status, ifood_confirmado_em").eq("ifood_order_id", orderId).limit(1);
  if (error) throw new Error(`falha ao ler pedido pra confirmar ${orderId}: ${error.message}`);
  const pedido = data?.[0];
  if (!pedido || pedido.ifood_confirmado_em || pedido.status === "cancelado") return;

  const token = await getAccessToken();
  if (!token) throw new Error("sem token de acesso pra confirmar o pedido");
  const res = await fetch(`${IFOOD_BASE_URL}/order/v1.0/orders/${orderId}/confirm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (await logSeRateLimited("confirmar_pedido", res)) throw new Error(`rate limit ao confirmar ${orderId}`);
  const body = await res.text().catch(() => "");
  const { error: logErr } = await supabase.from("logs_acoes").insert({
    acao: res.ok ? "ifood_confirmar_pedido" : "ifood_erro_confirmar_pedido_http",
    detalhes: { orderId, pedidoId: pedido.id, status: res.status, body, via: "webhook" },
  });
  if (logErr) console.error("[ifood-status-sync] FALHA AO GRAVAR LOG DO /confirm:", logErr.message);
  if (res.ok) { await marcarConfirmado(orderId); return; }
  if (res.status >= 500) throw new Error(`HTTP ${res.status} ao confirmar ${orderId}`);
}

// DDCR — só marca que o pedido exige código de entrega e loga o evento
// inteiro; o evento não traz o código. Mesma regra de ifood-polling/index.ts
// (ver comentário lá, 2026-09-30), duplicada aqui pelo mesmo motivo do
// resto do arquivo.
async function registrarDdcr(orderId: string, evento: any): Promise<void> {
  const { error: logErr } = await supabase.from("logs_acoes").insert({
    acao: "ifood_evento_ddcr",
    detalhes: { orderId, evento: evento ?? null, via: "webhook" },
  });
  if (logErr) console.error("[ifood-status-sync] FALHA AO GRAVAR LOG DO DDCR:", logErr.message);
  const { error } = await supabase.from("pedidos")
    .update({ ifood_codigo_entrega_exigido_em: new Date().toISOString() })
    .eq("ifood_order_id", orderId).is("ifood_codigo_entrega_exigido_em", null);
  if (error) throw new Error(`falha ao marcar código de entrega exigido ${orderId}: ${error.message}`);
}

async function tratarWebhook(req: Request, assinaturaRecebida: string): Promise<Response> {
  const rawBody = new Uint8Array(await req.arrayBuffer());

  const assinaturaValida = await validarAssinaturaWebhook(rawBody, assinaturaRecebida);
  if (!assinaturaValida) {
    await logErro("webhook_assinatura_invalida", {});
    return new Response(JSON.stringify({ error: "assinatura inválida" }), { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch (e) {
    await logErro("webhook_parse", { message: String(e) });
    return new Response(JSON.stringify({ error: "body inválido" }), { status: 400 });
  }

  const eventos = Array.isArray(payload) ? payload : [payload];

  try {
    // Paralelo — precisa responder em até 5s (exigência da doc), não dá
    // pra serializar se vier mais de um evento no mesmo webhook. Cada
    // branch de processarEventoWebhook é idempotente por natureza (setar
    // status pra 'cancelado'/'finalizado' de novo, ou upsert do mesmo
    // pedido mapeado de novo, não duplica nem corrompe nada), então retry
    // do iFood em 5xx é seguro.
    // Confirmação roda depois de todos os eventos gravados (o PLC pode
    // criar o pedido no mesmo Promise.all) e pula quem tem CFM no lote.
    await Promise.all(eventos.map((evento) => processarEventoWebhook(evento)));
    const codigo = (e: any) => e?.code ?? e?.fullCode ?? null;
    const idPedido = (e: any) => e?.orderId ?? e?.id;
    const cfmNoLote = new Set(eventos.filter((e) => ehEvento(codigo(e), "CFM", "CONFIRMED")).map(idPedido));
    await Promise.all([...cfmNoLote].filter(Boolean).map((orderId) => marcarConfirmado(orderId)));
    const plcs = [...new Set(eventos.filter((e) => ehEvento(codigo(e), "PLC", "PLACED")).map(idPedido))].filter(Boolean);
    await Promise.all(plcs.map((orderId) => confirmarPedidoSeNecessario(orderId, cfmNoLote.has(orderId))));
    const ddcrs = eventos.filter((e) => ehEvento(codigo(e), "DDCR", "DELIVERY_DROP_CODE_REQUESTED") && idPedido(e));
    await Promise.all(ddcrs.map((e) => registrarDdcr(idPedido(e), e)));
  } catch (e) {
    await logErro("webhook_processar_excecao", { message: String(e) });
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }

  return new Response(null, { status: 202 });
}

serve(async (req) => {
  const assinaturaWebhook = req.headers.get("X-IFood-Signature");
  if (req.method === "POST" && assinaturaWebhook) {
    return await tratarWebhook(req, assinaturaWebhook);
  }

  // verify_jwt=false (config.toml) foi desligado pra função inteira, não só
  // pro branch do webhook — sem isso, esse trecho (leitura da fila e envio
  // de status pro iFood) ficaria acessível sem autenticação nenhuma pra
  // qualquer um na internet. cron_dispatch_key (vault) é a service role key
  // do projeto, mesmo valor que a function já tem em SUPABASE_SERVICE_ROLE_KEY.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response(JSON.stringify({ ok: false, motivo: "não autorizado" }), { status: 401 });
  }

  const token = await getAccessToken();
  if (!token) {
    return new Response(JSON.stringify({ ok: false, motivo: "sem token de acesso" }), { status: 200 });
  }

  const { data: fila, error: filaErr } = await supabase
    .from("ifood_status_queue")
    .select("id, pedido_id, evento, tentativas, pedidos(ifood_order_id)")
    .in("status", ["pendente", "erro"])
    .lt("tentativas", MAX_TENTATIVAS)
    .order("criado_em", { ascending: true })
    .limit(50);

  if (filaErr) {
    await logErro("ler_fila", { message: filaErr.message });
    return new Response(JSON.stringify({ ok: false, motivo: "erro ao ler fila" }), { status: 200 });
  }

  let enviados = 0, comErro = 0;

  for (const item of fila || []) {
    const ifoodOrderId = (item as any).pedidos?.ifood_order_id;
    if (!ifoodOrderId) {
      await logErro("fila_sem_ifood_order_id", { queueId: item.id, pedidoId: item.pedido_id });
      await supabase.from("ifood_status_queue").update({
        status: "erro", tentativas: item.tentativas + 1, erro: "pedido sem ifood_order_id",
      }).eq("id", item.id);
      comErro++;
      continue;
    }

    try {
      const path = endpointParaEvento(ifoodOrderId, item.evento);
      const corpo = item.evento === "assignDriver" ? await montarCorpoAssignDriver(item.pedido_id) : undefined;
      // assignDriver sem corpo o iFood recusa (400 "No request body"): não
      // chama. Sem entregador alocado, encerra o item (se o pedido voltar a
      // 'aceito', o gatilho enfileira um assignDriver novo); falha de leitura
      // do banco só gasta uma tentativa.
      if (item.evento === "assignDriver" && !corpo) {
        const semEntregador = corpo === null;
        await supabase.from("ifood_status_queue").update({
          status: "erro",
          tentativas: semEntregador ? MAX_TENTATIVAS : item.tentativas + 1,
          erro: semEntregador ? "sem entregador alocado" : "falha ao montar corpo do assignDriver",
        }).eq("id", item.id);
        comErro++;
        continue;
      }
      const res = await fetch(`${IFOOD_BASE_URL}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(corpo ? { body: corpo } : {}),
      });

      // Item 16 do checklist de homologação: 429 aqui é limite global do
      // token, não culpa desse item específico da fila — não gasta uma das
      // MAX_TENTATIVAS dele, deixa 'pendente' como está e para de bater no
      // resto da fila nessa rodada (senão os outros ~49 itens repetem o
      // mesmo 429 em sequência). Próxima invocação do cron tenta de novo.
      if (await logSeRateLimited("enviar_status", res)) break;

      if (res.ok) {
        await supabase.from("ifood_status_queue").update({
          status: "enviado", enviado_em: new Date().toISOString(),
        }).eq("id", item.id);
        enviados++;
      } else {
        const body = await res.text().catch(() => "");
        await logErro("enviar_status_http", { queueId: item.id, ifoodOrderId, evento: item.evento, status: res.status, body });
        await supabase.from("ifood_status_queue").update({
          status: "erro", tentativas: item.tentativas + 1, erro: `HTTP ${res.status}: ${body.slice(0, 500)}`,
        }).eq("id", item.id);
        comErro++;
      }
    } catch (e) {
      await logErro("enviar_status_excecao", { queueId: item.id, ifoodOrderId, evento: item.evento, message: String(e) });
      await supabase.from("ifood_status_queue").update({
        status: "erro", tentativas: item.tentativas + 1, erro: String(e),
      }).eq("id", item.id);
      comErro++;
    }
  }

  return new Response(JSON.stringify({ ok: true, enviados, comErro }), { status: 200 });
});
