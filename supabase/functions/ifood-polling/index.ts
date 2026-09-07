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
    .select("id, nome, endereco, latitude, longitude")
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
function extrairPagamento(d: any) {
  const metodo = d.payments?.methods?.[0] ?? null;
  return {
    forma_pagamento: metodo?.method ?? metodo?.type ?? null,
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

async function mapearPedidoIfood(d: any) {
  const agora = new Date().toISOString();
  const merchantId = d.merchant?.id ?? null;
  const loja = await buscarLojaPorMerchantId(merchantId);
  if (!loja) await logErro("merchant_id_sem_loja_correspondente", { merchantId, merchantName: d.merchant?.name ?? null });
  const pagamento = extrairPagamento(d);
  const cupom = extrairCupom(d);
  return {
    ifood_order_id: d.id ?? d.orderId,
    numero: String(d.displayId ?? d.id),
    numero_loja: String(d.displayId ?? d.id),
    origem: "ifood",
    status: "pronto",
    status_detalhado: "pronto",
    pagamento_confirmado: true,
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
    itens: d.items ?? [],
    valor: d.total?.subTotal ?? d.total?.orderAmount ?? 0,
    total_pedido: d.total?.orderAmount ?? 0,
    taxa_entrega: d.total?.deliveryFee ?? 0,
    ...pagamento,
    ...cupom,
    recebido_em: agora,
    pronto_em: agora,
    created_at: agora,
    updated_at: agora,
  };
}

async function buscarDetalhesPedido(orderId: string, token: string) {
  // Confirmado contra a doc oficial (Order API):
  // https://developer.ifood.com.br/en-US/docs/guides/modules/order/details/
  const res = await ifoodFetch(`/order/v1.0/orders/${orderId}`, token, { method: "GET" });
  if (await logSeRateLimited("detalhes_pedido", res)) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    await logErro("detalhes_pedido_http", { orderId, status: res.status, body });
    return null;
  }
  try {
    return await res.json();
  } catch (e) {
    await logErro("detalhes_pedido_parse", { orderId, message: String(e) });
    return null;
  }
}

// Códigos de evento confirmados contra a doc pública do iFood (Order
// events / Shipping "Entrega Fácil", 2026-09-07): PLC=PLACED,
// CFM=CONFIRMED, SPS=SEPARATION_STARTED, SPE=SEPARATION_ENDED,
// RTP=READY_TO_PICKUP, DSP=DISPATCHED, CON=CONCLUDED, CAN=CANCELLED,
// DAR=DELIVERY_ADDRESS_CHANGE_REQUESTED (metadata.address com o endereço
// novo; lojista tem 15min corridos pra aceitar/rejeitar antes do iFood
// rejeitar automaticamente).
//
// Bug real corrigido aqui: o upsert antigo usava `ignoreDuplicates:true`,
// que faz ON CONFLICT DO NOTHING — pra um ifood_order_id que já existe na
// tabela, QUALQUER evento subsequente (inclusive cancelamento pelo cliente,
// ou conclusão por outro app tipo Gestor de Pedidos) era descartado sem
// nenhum efeito. Agora: pedido novo entra pelo fluxo de sempre; pedido já
// existente só é tocado se o evento for CAN, CON ou DAR (os únicos que
// mudam algo de forma inequívoca) — qualquer outro evento pra pedido
// existente é só reconhecido (ACK), sem sobrescrever progresso interno já
// em andamento (em_rota/chegou_destino etc., escritos pelo app do
// entregador).
async function processarEventoPedido(orderId: string, code: string | null, metadata: any, token: string): Promise<boolean> {
  const { data: existente, error: existeErr } = await supabase
    .from("pedidos")
    .select("id, status")
    .eq("ifood_order_id", orderId)
    .limit(1);
  if (existeErr) { await logErro("checar_pedido_existente", { orderId, message: existeErr.message }); return false; }

  if (existente && existente[0]) {
    const atual = existente[0] as { id: string; status: string | null };
    if (code === "CAN" && atual.status !== "cancelado") {
      const { error } = await supabase.from("pedidos").update({
        status: "cancelado", status_detalhado: "cancelado", updated_at: new Date().toISOString(),
      }).eq("id", atual.id);
      if (error) { await logErro("atualizar_status_cancelado", { orderId, message: error.message }); return false; }
    } else if (code === "CON" && atual.status !== "cancelado" && atual.status !== "finalizado") {
      const { error } = await supabase.from("pedidos").update({
        status: "finalizado", status_detalhado: "finalizado", updated_at: new Date().toISOString(),
      }).eq("id", atual.id);
      if (error) { await logErro("atualizar_status_concluido", { orderId, message: error.message }); return false; }
    } else if (code === "DAR" && metadata?.address) {
      const { error } = await supabase.from("pedidos").update({
        troca_endereco_novo: metadata.address, troca_endereco_solicitada_em: new Date().toISOString(),
      }).eq("id", atual.id);
      if (error) { await logErro("registrar_troca_endereco", { orderId, message: error.message }); return false; }
    }
    return true;
  }

  // Pedido novo (primeira vez que vemos esse ifood_order_id): busca
  // detalhes completos e cria. upsert (não insert puro) como rede de
  // segurança pra corrida rara entre polling e webhook processando o mesmo
  // pedido novo ao mesmo tempo.
  const detalhes = await buscarDetalhesPedido(orderId, token);
  if (!detalhes) return false;
  const pedido = await mapearPedidoIfood(detalhes);
  const { error: upsertErr } = await supabase.from("pedidos").upsert(pedido, { onConflict: "ifood_order_id" });
  if (upsertErr) {
    await logErro("persistir_pedido", { orderId, message: upsertErr.message });
    return false;
  }
  return true;
}

// Retorna true quando o polling levou 429 (rate limit) — sinal pro serve()
// não insistir na segunda iteração da mesma invocação.
async function pollOnce(token: string): Promise<boolean> {
  // excludeHeartbeat=true é obrigatório para integradores de Logistics
  // (senão conta como "abrir a loja" e trava cancelamento no lado iFood).
  const res = await ifoodFetch("/events/v1.0/events:polling?excludeHeartbeat=true", token, { method: "GET" });

  if (await logSeRateLimited("polling", res)) return true;
  if (res.status === 204) return false;
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

  const acks: string[] = [];

  for (const evento of eventos || []) {
    const orderId = evento.orderId ?? evento.id;
    if (!orderId) {
      await logErro("polling_evento_sem_orderId", { evento });
      continue; // sem ACK — se for evento real, volta no próximo polling
    }
    const code = evento.code ?? evento.fullCode ?? null;

    try {
      const ok = await processarEventoPedido(orderId, code, evento.metadata, token);
      if (!ok) continue; // erro já logado; sem ACK, tenta de novo
      acks.push(evento.id ?? orderId);
    } catch (e) {
      await logErro("processar_evento_excecao", { orderId, message: String(e) });
    }
  }

  if (acks.length > 0) {
    // TODO confirmar path e formato exato do body esperado por
    // /events/acknowledgment (doc pública não detalha o schema do body).
    const ackRes = await ifoodFetch("/events/v1.0/events/acknowledgment", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(acks.map((id) => ({ id }))),
    });
    if (await logSeRateLimited("acknowledgment", ackRes)) return true;
    if (!ackRes.ok) {
      const body = await ackRes.text().catch(() => "");
      await logErro("acknowledgment_http", { status: ackRes.status, body, acks });
    }
  }
  return false;
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
  for (let i = 0; i < 2; i++) {
    const token = await getAccessToken();
    if (!token) {
      problemas.push("sem token de acesso — ver logs_acoes (ifood_erro_auth*)");
      break;
    }
    try {
      const rateLimited = await pollOnce(token);
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
