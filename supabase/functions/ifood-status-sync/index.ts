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

// TODO confirmar contra a doc autenticada: paths exatos. Pesquisa pública
// indicou POST /goingToOrigin, /arrivedAtOrigin, /dispatch,
// /arrivedAtDestination sob o recurso do pedido de logistics — formato
// abaixo (/logistics/orders/{id}/{evento}) é a reconstrução mais provável,
// mas não confirmada. Ajustar antes de ligar em produção.
function endpointParaEvento(ifoodOrderId: string, evento: string): string {
  return `/logistics/orders/${ifoodOrderId}/${evento}`;
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
async function mapearPedidoIfood(d: any) {
  const agora = new Date().toISOString();
  const merchantId = d.merchant?.id ?? null;
  const loja = await buscarLojaPorMerchantId(merchantId);
  if (!loja) await logErro("merchant_id_sem_loja_correspondente", { merchantId, merchantName: d.merchant?.name ?? null });
  return {
    ifood_order_id: d.id ?? d.orderId,
    numero: String(d.displayId ?? d.id),
    numero_loja: String(d.displayId ?? d.id),
    origem: "ifood",
    status: "pronto",
    status_detalhado: "pronto",
    pagamento_confirmado: true,
    loja_id: loja?.id ?? null,
    endereco: d.delivery?.deliveryAddress?.formattedAddress ?? "",
    latitude: d.delivery?.deliveryAddress?.coordinates?.latitude ?? null,
    longitude: d.delivery?.deliveryAddress?.coordinates?.longitude ?? null,
    endereco_coleta: loja?.endereco ?? "",
    latitude_coleta: loja?.latitude ?? null,
    longitude_coleta: loja?.longitude ?? null,
    contato_coleta: loja?.nome ?? d.merchant?.name ?? null,
    cliente: d.customer?.name ?? "",
    telefone: d.customer?.phone?.number ?? null,
    itens: d.items ?? [],
    valor: d.total?.subTotal ?? d.total?.orderAmount ?? 0,
    total_pedido: d.total?.orderAmount ?? 0,
    taxa_entrega: d.total?.deliveryFee ?? 0,
    recebido_em: agora,
    pronto_em: agora,
    created_at: agora,
    updated_at: agora,
  };
}

async function buscarDetalhesPedidoWebhook(orderId: string, token: string) {
  const res = await fetch(`${IFOOD_BASE_URL}/order/v1.0/orders/${orderId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
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

// Um evento de webhook = uma mudança de status (ou pedido novo) — busca os
// detalhes atuais do pedido na Order API e faz upsert em `pedidos`, mesmo
// fluxo que ifood-polling já faz pra cada evento do polling. Lança exceção
// em qualquer falha real (não em "evento sem orderId", que é esperado pra
// presence events) — o chamador decide se isso vira 5xx (retry do iFood).
async function processarEventoWebhook(evento: any): Promise<void> {
  const orderId = evento?.orderId ?? evento?.id;
  if (!orderId) {
    await logErro("webhook_evento_sem_orderId", { evento });
    return;
  }
  const token = await getAccessToken();
  if (!token) throw new Error("sem token de acesso pra buscar detalhes do pedido");

  const detalhes = await buscarDetalhesPedidoWebhook(orderId, token);
  if (!detalhes) throw new Error(`falha ao buscar detalhes do pedido ${orderId}`);

  const pedido = await mapearPedidoIfood(detalhes);
  const { error } = await supabase.from("pedidos").upsert(pedido, { onConflict: "ifood_order_id", ignoreDuplicates: true });
  if (error) {
    await logErro("webhook_persistir_pedido", { orderId, message: error.message });
    throw new Error(`falha ao persistir pedido ${orderId}: ${error.message}`);
  }
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
    // pra serializar se vier mais de um evento no mesmo webhook. Upsert é
    // idempotente (ignoreDuplicates), então retry do iFood em 5xx nunca
    // duplica os eventos que já tinham sido processados com sucesso.
    await Promise.all(eventos.map((evento) => processarEventoWebhook(evento)));
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
      const res = await fetch(`${IFOOD_BASE_URL}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });

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
