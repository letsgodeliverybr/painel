import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const IFOOD_CLIENT_ID = Deno.env.get("IFOOD_CLIENT_ID") ?? "";
const IFOOD_CLIENT_SECRET = Deno.env.get("IFOOD_CLIENT_SECRET") ?? "";
const IFOOD_BASE_URL = "https://merchant-api.ifood.com.br";

// Regra de ouro desta integração (aprendida hoje, do jeito caro): nenhuma
// falha pode ser silenciosa. Toda chamada externa (auth, polling, detalhes
// de pedido, acknowledgment) passa por aqui em caso de erro — vira uma linha
// consultável em logs_acoes, nunca só um console.error perdido.
async function logErro(fonte: string, detalhes: Record<string, unknown>) {
  const { error } = await supabase.from("logs_acoes").insert({
    acao: `ifood_erro_${fonte}`,
    detalhes,
  });
  if (error) {
    console.error(`[ifood-polling] FALHA AO GRAVAR LOG DE ERRO (${fonte}):`, error.message, detalhes);
  }
}

async function upsertConfig(chave: string, valor: string) {
  const { data, error: selErr } = await supabase.from("configuracoes").select("chave").eq("chave", chave).limit(1);
  if (selErr) { await logErro("config_ler", { chave, message: selErr.message }); return; }
  const { error: writeErr } = (data && data.length > 0)
    ? await supabase.from("configuracoes").update({ valor }).eq("chave", chave)
    : await supabase.from("configuracoes").insert({ chave, valor });
  if (writeErr) await logErro("config_gravar", { chave, message: writeErr.message });
}

// Token cacheado em `configuracoes` (mesmo padrão já usado por outras
// integrações do painel) — evita autenticar a cada polling. Token expira em
// 6h segundo a documentação; renovamos com 5min de margem.
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

    // TODO confirmar contra a doc autenticada: nome exato dos campos de
    // resposta (accessToken/access_token, expiresIn/expires_in).
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

async function ifoodFetch(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${IFOOD_BASE_URL}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
}

// Item 16 do checklist de homologação: respeitar rate limit. Confirmado
// contra a doc pública do iFood (Rate limit, 2026-09-07): 429 vem com
// header Retry-After (segundos); polling especificamente é limitado a 1
// request/30s por token. Qualquer 429 vira log dedicado (searchável
// separado dos outros erros HTTP) e sinaliza pro chamador parar de bater
// nessa rodada em vez de insistir — a rodada seguinte do cron (ou a
// próxima invocação) tenta de novo.
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

// Campos confirmados contra um pedido de teste real (Developer Portal do
// iFood, pedido 59739b17-c690-4795-8c8a-ad9fa02d048c, 2026-07-25):
// id, displayId, delivery.deliveryAddress.{formattedAddress,coordinates},
// merchant.{id,name}, customer.name, customer.phone.number, items[],
// total.{subTotal,deliveryFee,orderAmount}.
//
// NÃO existe endereço da loja nesse payload (merchant só tem id/name) — a
// única fonte confiável de endereço/coordenadas da loja é o nosso próprio
// cadastro, resolvido via merchant.id -> lojas.ifood_merchant_id (ver
// migração add_ifood_merchant_id_lojas.sql). loja_id do pedido também vem
// daqui — antes disso, pedidos do iFood eram gravados SEM loja_id nenhum.
async function buscarLojaPorMerchantId(merchantId: string | null | undefined) {
  if (!merchantId) return null;
  const { data, error } = await supabase
    .from("lojas")
    .select("id, nome, endereco, latitude, longitude, tipo_cobranca")
    .eq("ifood_merchant_id", merchantId)
    .limit(1);
  if (error) { await logErro("buscar_loja_merchant_id", { merchantId, message: error.message }); return null; }
  return data && data[0] ? data[0] : null;
}
// payments/benefits/customer.documentNumber confirmados contra a doc
// pública do iFood (Order Details / Order events, 2026-09-07) — vinham na
// resposta de /order/v1.0/orders/{id} e eram descartados até aqui.
// payments.methods[] pode ter mais de um método (split payment); pegamos o
// primeiro pra exibição — suficiente pro requisito de homologação (mostrar
// bandeira/troco em tela), não é uma reconciliação financeira completa.
// iFood manda o método em inglês (Order API pública, 2026-09-16: CREDIT,
// DEBIT, MEAL_VOUCHER, FOOD_VOUCHER, CASH, PIX, OTHER) — traduzido pro
// vocabulário da constraint pedidos_forma_pagamento_check
// (dinheiro/cartao/pix/outro). Sem isso, valor não reconhecido derrubava
// o upsert inteiro do pedido.
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
// Sem payments (/logistics não manda): forma de pagamento fica vazia em vez
// de 'outro' — ver ALERTA_PAGAMENTO_NAO_INFORMADO em mapearPedidoIfood.
function extrairPagamento(d: any) {
  if (!d.payments) return { forma_pagamento: null, bandeira_cartao: null, troco_para: null };
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
// tratado em processarEventoPedido, promove pra 'pronto' depois — mesmo
// papel de "loja clica em pronto"); orderTiming SCHEDULED -> 'agendado' +
// agendado_para (timestamptz REAL — o iFood já manda em UTC de verdade,
// não passa por agoraBrasiliaNaive, mesmo tratamento que criarPedido/
// salvarEdicaoPedido já dão a essa coluna no painel). _runScheduler()
// (app.js) já promove qualquer agendado->pronto na hora certa, de
// qualquer origem — nenhuma mudança necessária ali.
function statusInicialIfood(d: any): { status: string; agendadoPara: string | null } {
  const schedule = d.schedule ?? d.scheduled ?? null;
  const agendado = d.orderTiming === "SCHEDULED" && !!schedule?.deliveryDateTimeStart;
  return {
    status: agendado ? "agendado" : "recebido",
    agendadoPara: agendado ? schedule.deliveryDateTimeStart : null,
  };
}

// Pedido sem payments (2026-10-29, /logistics): NÃO presume que está pago.
// Fica pagamento_confirmado=false e o aviso vai em descricao (Observações —
// aparece no app do entregador e, com destaque, no painel; o texto é a
// chave que o painel procura, não mudar sem mudar _alertaPagamentoIfood no
// app.js). com_retorno/valor ficam como pedido pago online (false/0): sem
// saber o valor, não manda o entregador cobrar nem trava a finalização.
const ALERTA_PAGAMENTO_NAO_INFORMADO = "Pagamento não informado pelo iFood, confirmar com a loja";

// Trava de loja de crédito: o pedido entra no painel em 'recebido' e o RTP
// do iFood NÃO o leva a 'pronto' enquanto estiver retido (ver
// processarEventoPedido) — sem isso o despacho-engine mandaria pra
// entregador sem debitar o saldo. O aviso de pagamento, quando houver, vem
// antes (o painel procura o texto no começo das Observações).
// Etapa 2b (2026-10-31): o pedido já nasce retido (credito_retido_em) e o
// banco tenta debitar na hora (processar_credito_pedido_ifood). Se o saldo
// cobre, o próprio banco tira este aviso; se não, troca por "saldo
// insuficiente". O prefixo "Loja de crédito: pedido retido" é o que o painel
// procura — não mudar sem mudar _ALERTA_CREDITO_IFOOD no app.js.
const ALERTA_LOJA_CREDITO_RETIDO = "Loja de crédito: pedido retido, conferindo saldo";

// Km e taxas do pedido iFood (2026-10-30), do mesmo jeito do Novo Pedido do
// painel (_criarPedidoInterno): distância de rota loja → cliente pelo Google
// Routes (carro, com alternativas, a mais curta que não demore mais de 30% —
// _rotaMaisCurtaAceitavel do app.js); sem resposta do Google, linha reta, como
// o painel. Preço pela tabela de cobrança/pagamento da loja + preço dinâmico
// vigente, via od_calcular_preco (a mesma conta do painel, já usada pelo Open
// Delivery). Km 0 (cliente no endereço da loja) ou sem km cobra e paga a faixa
// mínima — od_valor_faixa usa 1 km, igual ao "||1" do painel —, nunca 0.
// Antes nada disso era gravado: distancia_km e taxa_motoboy ficavam no
// default 0 (motoboy aparecia com R$ 0) e taxa_entrega era a taxa que o
// cliente pagou ao iFood. Se o preço falhar, taxa_motoboy fica null (não 0)
// e o painel recalcula pela faixa.
const ROTA_TEMPO_MAX = 1.3;
function kmLinhaReta(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (g: number) => g * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function kmRota(lat1: number, lng1: number, lat2: number, lng2: number): Promise<number | null> {
  const key = Deno.env.get("GOOGLE_ROUTES_KEY");
  if (!key) return null;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.routeLabels" },
      body: JSON.stringify({ origin: { location: { latLng: { latitude: lat1, longitude: lng1 } } },
        destination: { location: { latLng: { latitude: lat2, longitude: lng2 } } }, travelMode: "DRIVE", computeAlternativeRoutes: true }),
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const validas = ((await r.json())?.routes || []).filter((x: any) => x?.distanceMeters > 0);
    if (!validas.length) return null;
    const seg = (x: any) => parseFloat(String(x?.duration || "").replace("s", "")) || 0;
    const padrao = validas.find((x: any) => (x.routeLabels || []).includes("DEFAULT_ROUTE")) || validas[0];
    const limite = seg(padrao) * ROTA_TEMPO_MAX;
    const aceitas = limite > 0 ? validas.filter((x: any) => x === padrao || (seg(x) > 0 && seg(x) <= limite)) : [padrao];
    return aceitas.reduce((a: any, b: any) => b.distanceMeters < a.distanceMeters ? b : a).distanceMeters / 1000;
  } catch { return null; }
}
async function calcularKmETaxas(loja: any, lat: number | null, lng: number | null, comRetorno: boolean, orderId: string | null) {
  if (!loja?.id) return { taxa_motoboy: null };
  let km: number | null = null;
  const temCoord = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  if (temCoord && loja.latitude != null && loja.longitude != null) {
    const [la, lo] = [Number(loja.latitude), Number(loja.longitude)];
    km = await kmRota(la, lo, lat!, lng!) ?? kmLinhaReta(la, lo, lat!, lng!);
    km = Math.round(km * 100) / 100;
  }
  const dist = km !== null ? { distancia_km: km } : {};
  const { data, error } = await supabase.rpc("od_calcular_preco", { p_loja_id: loja.id, p_km: km, p_retorno: comRetorno });
  const taxa = Number(data?.taxa), moto = Number(data?.taxa_moto);
  if (error || !Number.isFinite(taxa) || !Number.isFinite(moto)) {
    await logErro("calcular_preco_pedido", { orderId, lojaId: loja.id, km, message: error?.message ?? "sem preço", via: "polling" });
    return { ...dist, taxa_motoboy: null };
  }
  return { ...dist, taxa_entrega: taxa, taxa_motoboy: moto, taxa_entrega_motoboy: moto,
    preco_dinamico: Number(data.pd) || 0, preco_dinamico_origem: data.pd_origem ?? null };
}

async function mapearPedidoIfood(d: any) {
  const agora = agoraBrasiliaNaive();
  const merchantId = d.merchant?.id ?? null;
  const loja = await buscarLojaPorMerchantId(merchantId);
  if (!loja) await logErro("merchant_id_sem_loja_correspondente", { merchantId, merchantName: d.merchant?.name ?? null });
  const pagamento = extrairPagamento(d);
  const cupom = extrairCupom(d);
  const { status: statusInicial, agendadoPara } = statusInicialIfood(d);
  // Bug real corrigido (2026-09-19): pagamento_confirmado era sempre true
  // pra QUALQUER pedido iFood, presumindo que todo pedido do iFood é pago
  // dentro do app — errado pra "pagamento na entrega" (dinheiro OU
  // cartão/maquininha física, que também aparece como forma_pagamento
  // 'cartao' — a bandeira do cartão não diz nada sobre isso). Campo certo
  // confirmado contra um pedido real e a doc oficial: payments.pending
  // (R$ que ainda falta cobrar) e payments.methods[].prepaid/type. Só
  // 43 pedidos reais existiam no banco até agora, todos com pending=0
  // (sandbox do iFood só gera pedido de teste 100% pago online) — sem
  // exemplo real de pending>0 pra validar visualmente, implementado com
  // base na doc + estrutura real confirmada.
  const semPagamento = !d.payments;
  const retidoCredito = loja?.tipo_cobranca === "credito";
  const avisos = [semPagamento ? ALERTA_PAGAMENTO_NAO_INFORMADO : null, retidoCredito ? ALERTA_LOJA_CREDITO_RETIDO : null]
    .filter(Boolean).join(" | ");
  if (semPagamento) await logErro("pagamento_nao_informado", { orderId: d.id ?? d.orderId ?? null, merchantId });
  const pendente = semPagamento ? 0 : (d.payments.pending ?? 0);
  const precos = await calcularKmETaxas(loja, d.delivery?.deliveryAddress?.coordinates?.latitude ?? null,
    d.delivery?.deliveryAddress?.coordinates?.longitude ?? null, pendente > 0, d.id ?? d.orderId ?? null);
  return {
    ifood_order_id: d.id ?? d.orderId,
    numero: String(d.displayId ?? d.id),
    numero_loja: String(d.displayId ?? d.id),
    origem: "ifood",
    status: statusInicial,
    status_detalhado: statusInicial,
    agendado_para: agendadoPara,
    pagamento_confirmado: !semPagamento && pendente <= 0,
    ...(avisos ? { descricao: avisos } : {}),
    // Etapa 2b: nasce retido (na dúvida não despacha); o banco libera.
    ...(retidoCredito ? { credito_retido_em: new Date().toISOString(), credito_motivo_retencao: "aguardando_debito" } : {}),
    // Pedido pago na entrega (pending>0): nosso entregador (entrega
    // própria, não é o iFood quem entrega) coleta o valor e precisa
    // devolver pra loja — mesmo fluxo de retorno/confirmação manual já
    // usado pra pedido de loja própria com com_retorno=true.
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
    // "valor" = quanto falta cobrar do cliente (pending), não o total do
    // pedido (isso já existe em total_pedido, abaixo) — era essa confusão
    // que fazia o app do entregador achar que tinha algo a cobrar mesmo em
    // pedido 100% pago online.
    valor: pendente,
    total_pedido: d.total?.orderAmount ?? 0,
    taxa_entrega: d.total?.deliveryFee ?? 0,
    ...precos,
    ...pagamento,
    ...cupom,
    recebido_em: statusInicial === "recebido" ? agora : null,
    pronto_em: null,
    created_at: agora,
    updated_at: agora,
  };
}

// Detalhes do pedido (2026-10-29): /order/v1.0/orders/{id} dá 403 pra este
// app (módulo Order não liberado — pedido de teste dd4aa63d, 28/10, nunca
// virou pedido no painel). /logistics/v1.0/orders/{id} responde 200 com o
// mesmo formato, mas SEM payments, benefits[], customer.documentNumber,
// pickupCode, schedule e preço dos itens (traz merchant.merchantAddress).
// Tenta /logistics primeiro; 403 ou 404 → /order (volta a valer quando o
// módulo Order for liberado). Cada falha continua logada.
const ENDPOINTS_DETALHES_PEDIDO = ["/logistics/v1.0/orders/", "/order/v1.0/orders/"];
async function buscarDetalhesPedido(orderId: string, token: string) {
  for (const endpoint of ENDPOINTS_DETALHES_PEDIDO) {
    const res = await ifoodFetch(`${endpoint}${orderId}`, token, { method: "GET" });
    if (await logSeRateLimited("detalhes_pedido", res)) return null;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      await logErro("detalhes_pedido_http", { orderId, endpoint, status: res.status, body });
      if (res.status === 403 || res.status === 404) continue;
      return null;
    }
    try {
      return await res.json();
    } catch (e) {
      await logErro("detalhes_pedido_parse", { orderId, endpoint, message: String(e) });
      return null;
    }
  }
  return null;
}

// Códigos de evento confirmados contra a doc pública do iFood (Order
// events / Shipping "Entrega Fácil", 2026-09-07): PLC=PLACED,
// CFM=CONFIRMED, SPS=SEPARATION_STARTED, SPE=SEPARATION_ENDED,
// RTP=READY_TO_PICKUP, DSP=DISPATCHED, CON=CONCLUDED, CAN=CANCELLED,
// DAR=DELIVERY_ADDRESS_CHANGE_REQUESTED (metadata.address com o endereço
// novo; lojista tem 15min corridos pra aceitar/rejeitar antes do iFood
// rejeitar automaticamente), DDCR=DELIVERY_DROP_CODE_REQUESTED (o pedido
// exige código de confirmação na entrega; o evento NÃO traz o código —
// quem tem é o cliente, e o entregador valida via POST .../verifyDeliveryCode.
// Tratado em registrarDdcr, mais abaixo).
//
// Bug real corrigido aqui: o upsert antigo usava `ignoreDuplicates:true`,
// que faz ON CONFLICT DO NOTHING — pra um ifood_order_id que já existe na
// tabela, QUALQUER evento subsequente (inclusive cancelamento pelo cliente,
// ou conclusão por outro app tipo Gestor de Pedidos) era descartado sem
// nenhum efeito. Agora: pedido novo entra pelo fluxo de sempre; pedido já
// existente só é tocado se o evento for CAN, CON, RTP, DAR ou DDCR (os
// únicos que mudam algo de forma inequívoca) — qualquer outro evento pra pedido
// existente é só reconhecido (ACK), sem sobrescrever progresso interno já
// em andamento (em_rota/chegou_destino etc., escritos pelo app do
// entregador).
async function processarEventoPedido(orderId: string, code: string | null, metadata: any, token: string): Promise<boolean> {
  const { data: existente, error: existeErr } = await supabase
    .from("pedidos")
    .select("id, status, loja_id, credito_retido_em, credito_liberado_em")
    .eq("ifood_order_id", orderId)
    .limit(1);
  if (existeErr) { await logErro("checar_pedido_existente", { orderId, message: existeErr.message }); return false; }

  if (existente && existente[0]) {
    const atual = existente[0] as { id: string; status: string | null; loja_id: string | null;
      credito_retido_em: string | null; credito_liberado_em: string | null };
    if (code === "CAN" && atual.status !== "cancelado") {
      const { error } = await supabase.from("pedidos").update({
        status: "cancelado", status_detalhado: "cancelado", updated_at: agoraBrasiliaNaive(),
      }).eq("id", atual.id);
      if (error) { await logErro("atualizar_status_cancelado", { orderId, message: error.message }); return false; }
    } else if (code === "CON" && atual.status !== "cancelado" && atual.status !== "finalizado") {
      const { error } = await supabase.from("pedidos").update({
        status: "finalizado", status_detalhado: "finalizado", updated_at: agoraBrasiliaNaive(),
      }).eq("id", atual.id);
      if (error) { await logErro("atualizar_status_concluido", { orderId, message: error.message }); return false; }
    } else if (code === "RTP" && atual.status !== "cancelado" && atual.status !== "finalizado") {
      // Retido (loja de crédito sem débito ainda): só guarda que o RTP chegou;
      // quando o banco liberar (débito feito), ele mesmo leva a 'pronto'.
      if (atual.credito_retido_em && !atual.credito_liberado_em) {
        const { error } = await supabase.from("pedidos").update({ ifood_rtp_em: new Date().toISOString() })
          .eq("id", atual.id).is("ifood_rtp_em", null);
        if (error) { await logErro("registrar_rtp_retido", { orderId, message: error.message }); return false; }
        return true;
      }
      // READY_TO_PICKUP — mesmo papel de "loja clica em Marcar como
      // pronto" nos pedidos próprios. Só isso libera o pedido pro
      // despacho-engine (que só olha status='pronto').
      const agora = agoraBrasiliaNaive();
      const { error } = await supabase.from("pedidos").update({
        status: "pronto", status_detalhado: "pronto", pronto_em: agora, updated_at: agora,
      }).eq("id", atual.id);
      if (error) { await logErro("atualizar_status_pronto", { orderId, message: error.message }); return false; }
    } else if (code === "DAR" && metadata?.address) {
      const { error } = await supabase.from("pedidos").update({
        troca_endereco_novo: metadata.address, troca_endereco_solicitada_em: new Date().toISOString(),
      }).eq("id", atual.id);
      if (error) { await logErro("registrar_troca_endereco", { orderId, message: error.message }); return false; }
    } else if (code === "REQUEST_DRIVER_SUCCESS" || code === "REQUEST_DRIVER_FAILED") {
      // Confirmação assíncrona do módulo Shipping (seletor "Sobre Demanda",
      // ifood-shipping/index.ts action:"solicitar") — chega pelo mesmo
      // polling de eventos do módulo Order, não um endpoint separado (doc
      // oficial confirmada em 2026-09-19). Nunca visto contra um evento
      // real ainda — nome exato do code não confirmado contra payload
      // real, só contra a doc; se vier diferente, ifood_shipping_status
      // simplesmente não atualiza e fica em "solicitado" (visível no log
      // de erro abaixo pra ajustar).
      const novoStatus = code === "REQUEST_DRIVER_SUCCESS" ? "sucesso" : "falha";
      const { error } = await supabase.from("pedidos").update({
        ifood_shipping_status: novoStatus, ifood_shipping_atualizado_em: new Date().toISOString(),
      }).eq("id", atual.id);
      if (error) { await logErro("atualizar_shipping_status", { orderId, code, message: error.message }); return false; }
    }
    return true;
  }

  // Pedido novo (primeira vez que vemos esse ifood_order_id): busca
  // detalhes completos e cria. Corrida com o webhook processando o mesmo
  // pedido: quem gravar primeiro vale e o outro NÃO sobrescreve
  // (ignoreDuplicates) — antes o segundo upsert reescrevia status/descricao
  // e podia desfazer a liberação do crédito.
  const detalhes = await buscarDetalhesPedido(orderId, token);
  if (!detalhes) return false;
  const pedido = await mapearPedidoIfood(detalhes);
  const { error: upsertErr } = await supabase.from("pedidos")
    .upsert(pedido, { onConflict: "ifood_order_id", ignoreDuplicates: true });
  if (upsertErr) {
    await logErro("persistir_pedido", { orderId, message: upsertErr.message });
    return false;
  }
  if (pedido.credito_retido_em) await processarCreditoPedido(orderId, "polling");
  return true;
}

// Etapa 2b: débito na criação, decidido no banco (trava por loja + débito
// único por pedido). Webhook e polling podem chamar os dois pro mesmo
// pedido: o segundo vira "já debitado". Falha aqui não perde nada — o
// pedido segue retido e a varredura do banco (cron, 1 min) tenta de novo.
async function processarCreditoPedido(orderId: string, via: string): Promise<void> {
  const { data, error } = await supabase.from("pedidos").select("id").eq("ifood_order_id", orderId).limit(1);
  if (error || !data?.[0]) { await logErro("credito_ler_pedido", { orderId, via, message: error?.message ?? "não achou" }); return; }
  const { data: res, error: rpcErr } = await supabase.rpc("processar_credito_pedido_ifood", { p_pedido_id: data[0].id });
  if (rpcErr) await logErro("credito_processar_pedido", { orderId, via, message: rpcErr.message });
  else await supabase.from("logs_acoes").insert({ acao: "credito_ifood_processado", detalhes: { orderId, via, res } });
}

// Confirmação automática do pedido no iFood (2026-09-30). Sem ela o iFood
// recusava verifyDeliveryCode com 422 ORDER_NOT_AVAILABLE_FOR_HANDSHAKE
// ("Order didn't have confirmation from merchant") e cancelava o pedido
// 8 minutos depois de criado (#6238, #8141, #1362) — nenhuma function
// chamava /confirm. Só confirma se o pedido ainda não estiver confirmado:
// ifood_confirmado_em vazio e nenhum CFM (aceite pelo Gestor de Pedidos)
// no mesmo lote de eventos. Resposta sempre logada em logs_acoes.
function ehEvento(code: string | null, curto: string, longo: string): boolean {
  return code === curto || code === longo;
}

async function marcarConfirmado(orderId: string): Promise<boolean> {
  const { error } = await supabase.from("pedidos")
    .update({ ifood_confirmado_em: new Date().toISOString() })
    .eq("ifood_order_id", orderId).is("ifood_confirmado_em", null);
  if (error) { await logErro("marcar_confirmado", { orderId, message: error.message }); return false; }
  return true;
}

// DDCR (DELIVERY_DROP_CODE_REQUESTED) — o iFood exige código de
// confirmação na entrega (2026-09-30). O evento NÃO traz o código: nos
// pedidos de teste #5952 e #7940 veio só com id/code/fullCode/createdAt/
// orderId/merchantId/salesChannel, sem metadata, 0,3s depois do /confirm.
// O código fica com o cliente, que informa ao entregador na porta, e é
// validado em ifood-validar-codigo (verifyDeliveryCode). Aqui só marca que
// o pedido exige código (ifood_codigo_entrega_exigido_em) e grava o evento
// inteiro em logs_acoes — também quando é o primeiro evento visto do
// pedido (antes só era tratado pra pedido já existente).
async function registrarDdcr(orderId: string, evento: any, via: string): Promise<boolean> {
  const { error: logErr } = await supabase.from("logs_acoes").insert({
    acao: "ifood_evento_ddcr",
    detalhes: { orderId, evento: evento ?? null, via },
  });
  if (logErr) console.error("[ifood-polling] FALHA AO GRAVAR LOG DO DDCR:", logErr.message);
  const { error } = await supabase.from("pedidos")
    .update({ ifood_codigo_entrega_exigido_em: new Date().toISOString() })
    .eq("ifood_order_id", orderId).is("ifood_codigo_entrega_exigido_em", null);
  if (error) { await logErro("marcar_codigo_entrega_exigido", { orderId, message: error.message }); return false; }
  return true;
}

// Retorna false só quando vale tentar de novo (429, 5xx, exceção) — o
// chamador não dá ACK no PLC e o iFood devolve o evento no próximo polling.
// 4xx é logado e não se repete (tentar de novo daria o mesmo erro).
async function confirmarPedidoSeNecessario(orderId: string, token: string, cfmNoLote: boolean): Promise<boolean> {
  if (cfmNoLote) return true;
  const { data, error } = await supabase
    .from("pedidos").select("id, status, ifood_confirmado_em").eq("ifood_order_id", orderId).limit(1);
  if (error) { await logErro("confirmar_ler_pedido", { orderId, message: error.message }); return false; }
  const pedido = data?.[0];
  if (!pedido || pedido.ifood_confirmado_em || pedido.status === "cancelado") return true;

  try {
    const res = await ifoodFetch(`/order/v1.0/orders/${orderId}/confirm`, token, { method: "POST" });
    if (await logSeRateLimited("confirmar_pedido", res)) return false;
    const body = await res.text().catch(() => "");
    const { error: logErr } = await supabase.from("logs_acoes").insert({
      acao: res.ok ? "ifood_confirmar_pedido" : "ifood_erro_confirmar_pedido_http",
      detalhes: { orderId, pedidoId: pedido.id, status: res.status, body, via: "polling" },
    });
    if (logErr) console.error("[ifood-polling] FALHA AO GRAVAR LOG DO /confirm:", logErr.message);
    if (res.ok) return await marcarConfirmado(orderId);
    return res.status < 500;
  } catch (e) {
    await logErro("confirmar_pedido_excecao", { orderId, message: String(e) });
    return false;
  }
}

// Item do checklist de homologação (confirmado com o suporte do iFood,
// 2026-09-16): filtra o polling só pelos merchants que essa integração
// realmente atende — sem isso a API devolve eventos de TODO merchant que
// o token acessa. Fonte da lista: lojas.ifood_merchant_id (não a API de
// merchants do iFood — é o que a gente já sabe que quer atender). Limite
// documentado: 100 IDs por header; acima de 500 merchants no token vira
// obrigatório. Só suporta 1 lote (≤100) por enquanto — ver aviso em
// buscarMerchantIdsPolling() pra quando isso crescer.
async function buscarMerchantIdsPolling(): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("lojas").select("ifood_merchant_id").not("ifood_merchant_id", "is", null);
  if (error) { await logErro("buscar_merchant_ids_polling", { message: error.message }); return null; }
  const ids = [...new Set((data || []).map((l: any) => l.ifood_merchant_id).filter(Boolean))];
  if (ids.length > 100) {
    // Rate limit do polling é 1 request/30s POR TOKEN — não dá pra simplesmente
    // disparar mais requests em lote dentro do mesmo minuto de cron pra cobrir
    // >100 merchants sem estourar 429. Precisa de redesenho (múltiplos tokens,
    // ou espalhar lotes por múltiplas invocações) quando chegar nesse volume.
    // Por ora: loga e cai pro polling sem filtro (pega todo merchant do token,
    // pior que filtrado mas não perde pedido nenhum).
    await logErro("merchant_ids_acima_de_100_sem_suporte", { total: ids.length });
    return null;
  }
  return ids;
}

// Retorna true quando o polling levou 429 (rate limit) — sinal pro serve()
// não insistir na segunda iteração da mesma invocação.
async function pollOnce(token: string, merchantIds: string[] | null): Promise<boolean> {
  // excludeHeartbeat=true é obrigatório para integradores de Logistics
  // (senão conta como "abrir a loja" e trava cancelamento no lado iFood).
  const headers: Record<string, string> = {};
  if (merchantIds && merchantIds.length > 0) headers["x-polling-merchants"] = merchantIds.join(",");
  const res = await ifoodFetch("/events/v1.0/events:polling?excludeHeartbeat=true", token, { method: "GET", headers });

  if (await logSeRateLimited("polling", res)) return true;
  // 204 = nada novo no iFood; mesmo assim reprocessa os pendentes (ex.: RTP
  // que falhou ao ler a loja) — antes só eram tentados quando chegava evento.
  if (res.status === 204) { await processarEventosPendentes(token); return false; }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    await logErro("polling_http", { status: res.status, body });
    return false;
  }

  let eventos: any[];
  try {
    eventos = await res.json();
  } catch (e) {
    await logErro("polling_parse", { message: String(e) });
    return false;
  }

  // Homologação: guarda o lote e confirma o recebimento (acknowledgment)
  // logo em seguida, antes de processar. O processamento lê da tabela
  // ifood_eventos_recebidos; o evento que falhar fica pendente e é tentado
  // de novo na próxima rodada, sem depender do iFood reenviar.
  const semId = (eventos || []).filter((e) => !e?.id);
  if (semId.length > 0) await logErro("polling_evento_sem_id", { eventos: semId });
  const linhas = (eventos || []).filter((e) => e?.id).map((e) => ({
    id: String(e.id),
    order_id: e.orderId ?? null,
    code: e.code ?? e.fullCode ?? null,
    origem: "polling",
    payload: e,
  }));
  let rateLimited = false;
  if (linhas.length > 0) {
    const { error } = await supabase.from("ifood_eventos_recebidos")
      .upsert(linhas, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      // Sem gravar não confirma: o iFood devolve o lote no próximo polling.
      await logErro("guardar_eventos", { message: error.message, total: linhas.length });
      return false;
    }
    rateLimited = await confirmarRecebimento(linhas.map((l) => l.id), token);
  }
  await processarEventosPendentes(token);
  return rateLimited;
}

// TODO confirmar path e formato exato do body esperado por
// /events/acknowledgment (doc pública não detalha o schema do body).
async function confirmarRecebimento(ids: string[], token: string): Promise<boolean> {
  const ackRes = await ifoodFetch("/events/v1.0/events/acknowledgment", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids.map((id) => ({ id }))),
  });
  if (await logSeRateLimited("acknowledgment", ackRes)) return true;
  if (!ackRes.ok) {
    const body = await ackRes.text().catch(() => "");
    await logErro("acknowledgment_http", { status: ackRes.status, body, acks: ids });
  }
  return false;
}

// Processa o que foi guardado e ainda não deu certo (lote atual + falhas de
// rodadas anteriores), na ordem do createdAt do iFood. Mesma regra de antes
// por evento; a diferença é que a falha fica marcada na tabela em vez de
// ficar sem acknowledgment.
const MAX_TENTATIVAS_EVENTO = 10;
async function processarEventosPendentes(token: string): Promise<void> {
  const { data, error } = await supabase.from("ifood_eventos_recebidos")
    .select("id, order_id, code, payload, tentativas")
    .eq("origem", "polling").is("processado_em", null).lt("tentativas", MAX_TENTATIVAS_EVENTO)
    .order("recebido_em", { ascending: true }).limit(50);
  if (error) { await logErro("ler_eventos_pendentes", { message: error.message }); return; }
  const pendentes = (data || []).sort((a: any, b: any) =>
    String(a.payload?.createdAt ?? "").localeCompare(String(b.payload?.createdAt ?? "")));
  // Pedidos já aceitos no Gestor de Pedidos dentro deste mesmo lote — não
  // chama /confirm pra eles mesmo que o PLC venha antes do CFM no array.
  const cfmNoLote = new Set(
    pendentes.filter((e: any) => ehEvento(e.code, "CFM", "CONFIRMED")).map((e: any) => e.order_id),
  );

  for (const ev of pendentes) {
    const orderId = ev.order_id;
    const code = ev.code;
    let ok = false, erro: string | null = null;
    try {
      if (!orderId) {
        await logErro("polling_evento_sem_orderId", { evento: ev.payload });
        ok = true; // nada a fazer com ele; não fica tentando para sempre
      } else {
        ok = await processarEventoPedido(orderId, code, ev.payload?.metadata, token);
        if (ok && ehEvento(code, "CFM", "CONFIRMED")) ok = await marcarConfirmado(orderId);
        else if (ok && ehEvento(code, "PLC", "PLACED")) ok = await confirmarPedidoSeNecessario(orderId, token, cfmNoLote.has(orderId));
        else if (ok && ehEvento(code, "DDCR", "DELIVERY_DROP_CODE_REQUESTED")) ok = await registrarDdcr(orderId, ev.payload, "polling");
      }
      if (!ok) erro = "falhou (detalhe em logs_acoes)";
    } catch (e) {
      erro = String(e);
      await logErro("processar_evento_excecao", { orderId, message: erro });
    }
    const { error: updErr } = await supabase.from("ifood_eventos_recebidos").update(
      ok ? { processado_em: new Date().toISOString(), tentativas: ev.tentativas + 1, ultimo_erro: null }
        : { tentativas: ev.tentativas + 1, ultimo_erro: erro },
    ).eq("id", ev.id);
    if (updErr) await logErro("marcar_evento", { id: ev.id, message: updErr.message });
  }
}

serve(async () => {
  const problemas: string[] = [];
  // iFood recomenda polling a cada ~30s; pg_cron deste projeto só agenda de
  // minuto em minuto — duas iterações internas por invocação aproximam a
  // cadência recomendada sem exigir nada fora do padrão já usado no cron.
  //
  // Item 16 do checklist de homologação: o limite documentado é 1
  // request/30s POR TOKEN nesse endpoint especificamente. O intervalo
  // original aqui era 28000ms — MENOR que o limite, arriscando 429 de
  // verdade em produção (as duas chamadas usam o mesmo token cacheado).
  // Subido pra 31000ms (folga de 1s) e, se mesmo assim vier 429, a segunda
  // iteração é pulada em vez de insistir.
  const merchantIds = await buscarMerchantIdsPolling();
  for (let i = 0; i < 2; i++) {
    const token = await getAccessToken();
    if (!token) {
      problemas.push("sem token de acesso — ver logs_acoes (ifood_erro_auth*)");
      break;
    }
    try {
      const rateLimited = await pollOnce(token, merchantIds);
      if (rateLimited) {
        problemas.push("rate limit (429) — ver logs_acoes (ifood_erro_rate_limit_*)");
        break;
      }
    } catch (e) {
      await logErro("poll_loop_excecao", { message: String(e) });
      problemas.push(String(e));
    }
    if (i === 0) await new Promise((r) => setTimeout(r, 31000));
  }
  return new Response(JSON.stringify({ ok: problemas.length === 0, problemas }), { status: 200 });
});
