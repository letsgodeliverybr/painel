import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fase 5 do checklist de homologação (achado ao investigar o item 9):
// pickupCode já vinha na resposta de /order/v1.0/orders/{id} e nunca era
// lido; o iFood também manda um código de confirmação de entrega via
// evento DDCR (metadata.CODE, ver ifood-polling/ifood-status-sync). Os
// dois precisam ser VALIDADOS de volta pro iFood — não basta exibir:
//   POST /order/v1.0/orders/{id}/validatePickupCode {code} — código que o
//     motoboy informa na coleta, comparado contra pickupCode.
//   POST /order/v1.0/orders/{id}/verifyDeliveryCode {code} — código que o
//     cliente informa na entrega; o iFood marca o pedido CONCLUDED
//     automaticamente depois de validar (chega de volta como evento CON,
//     já tratado desde a Fase 1).
// Ação disparada manualmente pelo painel (admin/loja digita o código que
// o motoboy reportou) OU pelo próprio app do entregador na tela de entrega
// (2026-09-16, ver entrega_screen.dart) — nesse segundo caso só a action
// "entrega" é aceita, autenticada pelo JWT do entregador (não pelo
// x-webhook-secret, que ficaria exposto num app compilado).
//
// Mesmo padrão de auth do resto do projeto (x-webhook-secret) — ver
// update-entregador-email/index.ts.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "letsgo2026secret";
const IFOOD_CLIENT_ID = Deno.env.get("IFOOD_CLIENT_ID") ?? "";
const IFOOD_CLIENT_SECRET = Deno.env.get("IFOOD_CLIENT_SECRET") ?? "";
const IFOOD_BASE_URL = "https://merchant-api.ifood.com.br";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function logErro(fonte: string, detalhes: Record<string, unknown>) {
  const { error } = await supabase.from("logs_acoes").insert({ acao: `ifood_erro_${fonte}`, detalhes });
  if (error) console.error(`[ifood-validar-codigo] FALHA AO GRAVAR LOG DE ERRO (${fonte}):`, error.message, detalhes);
}

async function upsertConfig(chave: string, valor: string) {
  const { data, error: selErr } = await supabase.from("configuracoes").select("chave").eq("chave", chave).limit(1);
  if (selErr) { await logErro("config_ler", { chave, message: selErr.message }); return; }
  const { error: writeErr } = (data && data.length > 0)
    ? await supabase.from("configuracoes").update({ valor }).eq("chave", chave)
    : await supabase.from("configuracoes").insert({ chave, valor });
  if (writeErr) await logErro("config_gravar", { chave, message: writeErr.message });
}

async function getAccessToken(): Promise<string | null> {
  const { data: cfg, error: cfgErr } = await supabase
    .from("configuracoes").select("chave, valor").in("chave", ["ifood_access_token", "ifood_token_expires_at"]);
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
      body: new URLSearchParams({ grantType: "client_credentials", clientId: IFOOD_CLIENT_ID, clientSecret: IFOOD_CLIENT_SECRET }),
    });
    if (res.status === 429) { await logErro("rate_limit_auth", { retryAfterSec: Number(res.headers.get("Retry-After")) || null }); return null; }
    const bodyText = await res.text();
    if (!res.ok) { await logErro("auth_http", { status: res.status, body: bodyText }); return null; }
    let respJson: any;
    try { respJson = JSON.parse(bodyText); } catch (e) { await logErro("auth_parse", { message: String(e), body: bodyText }); return null; }
    const token = respJson.accessToken ?? respJson.access_token;
    const expiresInSec = respJson.expiresIn ?? respJson.expires_in ?? 21600;
    if (!token) { await logErro("auth_resposta_sem_token", { body: bodyText }); return null; }
    await upsertConfig("ifood_access_token", token);
    await upsertConfig("ifood_token_expires_at", new Date(Date.now() + expiresInSec * 1000).toISOString());
    return token;
  } catch (e) {
    await logErro("auth_excecao", { message: String(e) });
    return null;
  }
}

// Envia na hora os eventos de logística ainda na fila deste pedido
// (2026-09-30). O cron de ifood-status-sync só roda de minuto em minuto:
// no #6238 a validação chegou às 21:40:33 e o dispatch/arrivedAtDestination
// só foram enviados às 21:41:01 — o iFood recebia o código antes de saber
// que o pedido tinha saído. Mesmo envio/atualização de fila do cron
// (ifood-status-sync), duplicado aqui pelo padrão do projeto. Retorna o
// primeiro evento que falhou, ou null se ficou tudo enviado.
const MAX_TENTATIVAS_FILA = 5;

function mapearVeiculoIfood(modal: string | null | undefined): string {
  switch (modal) {
    case "bicicleta": return "BICYCLE";
    case "carro": return "CAR";
    default: return "MOTORCYCLE";
  }
}

async function montarCorpoAssignDriver(pedidoId: string): Promise<string | undefined> {
  const { data: pedido } = await supabase.from("pedidos").select("motoboy_id, entregador_id").eq("id", pedidoId).maybeSingle();
  const entregadorId = pedido?.motoboy_id ?? pedido?.entregador_id ?? null;
  if (!entregadorId) return undefined;
  const { data: entregador } = await supabase.from("entregadores").select("nome, telefone, modal_veiculo").eq("id", entregadorId).maybeSingle();
  return JSON.stringify({
    workerName: entregador?.nome || "Entregador",
    workerPhone: (entregador?.telefone || "").replace(/\D/g, ""),
    workerVehicleType: mapearVeiculoIfood(entregador?.modal_veiculo),
  });
}

async function enviarFilaPendente(pedidoId: string, ifoodOrderId: string, token: string): Promise<{ evento: string; erro: string } | null> {
  const { data: fila, error } = await supabase
    .from("ifood_status_queue").select("id, evento, tentativas")
    .eq("pedido_id", pedidoId).in("status", ["pendente", "erro"]).lt("tentativas", MAX_TENTATIVAS_FILA)
    .order("criado_em", { ascending: true });
  if (error) return { evento: "fila", erro: error.message };
  for (const item of fila || []) {
    try {
      const corpo = item.evento === "assignDriver" ? await montarCorpoAssignDriver(pedidoId) : undefined;
      const res = await fetch(`${IFOOD_BASE_URL}/logistics/v1.0/orders/${ifoodOrderId}/${item.evento}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(corpo ? { body: corpo } : {}),
      });
      if (res.ok) {
        // Só marca se o cron não enviou no meio tempo (evita sobrescrever).
        await supabase.from("ifood_status_queue").update({ status: "enviado", enviado_em: new Date().toISOString() })
          .eq("id", item.id).in("status", ["pendente", "erro"]);
        continue;
      }
      const body = await res.text().catch(() => "");
      await logErro("enviar_status_http", { queueId: item.id, ifoodOrderId, evento: item.evento, status: res.status, body, via: "validar_codigo" });
      if (res.status !== 429) {
        await supabase.from("ifood_status_queue").update({
          status: "erro", tentativas: item.tentativas + 1, erro: `HTTP ${res.status}: ${body.slice(0, 500)}`,
        }).eq("id", item.id).in("status", ["pendente", "erro"]);
      }
      return { evento: item.evento, erro: `HTTP ${res.status}: ${body.slice(0, 300)}` };
    } catch (e) {
      await logErro("enviar_status_excecao", { queueId: item.id, ifoodOrderId, evento: item.evento, message: String(e), via: "validar_codigo" });
      return { evento: item.evento, erro: String(e) };
    }
  }
  return null;
}

// Tradução da recusa do iFood pra mensagem que o entregador/painel entende
// (2026-09-30). Antes toda resposta não-2xx virava "Código não confere ou
// falha na validação" (502) — inclusive o 422 ORDER_NOT_AVAILABLE_FOR_HANDSHAKE
// dos pedidos de teste, que não tinha nada a ver com o código digitado.
// Recusa de regra de negócio sai como 422 (não 502); erro de autenticação
// ou do iFood fora do ar continua 502.
function traduzirErroIfood(status: number, bodyText: string): { http: number; error: string; ifoodCode: string | null } {
  let ifoodCode: string | null = null;
  try { ifoodCode = JSON.parse(bodyText)?.code ?? null; } catch { /* corpo não-JSON */ }
  if (ifoodCode === "ORDER_NOT_AVAILABLE_FOR_HANDSHAKE") {
    return { http: 422, ifoodCode, error: "Pedido ainda não confirmado pela loja no iFood. Avise o suporte." };
  }
  if (status === 401 || status === 403) return { http: 502, ifoodCode, error: "Falha de autenticação com o iFood. Avise o suporte." };
  if (status === 404) return { http: 422, ifoodCode, error: "Pedido não encontrado no iFood. Avise o suporte." };
  if (status >= 500) return { http: 502, ifoodCode, error: "iFood fora do ar no momento. Tente de novo em instantes." };
  // Demais 4xx: o código exato de "código errado" do iFood ainda não foi
  // visto em resposta real — mostra o code dele junto pra identificar.
  return {
    http: 422,
    ifoodCode,
    error: `Código recusado pelo iFood${ifoodCode ? ` (${ifoodCode})` : ""}. Confira o código com o cliente.`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Duas formas de chamar essa function: painel web (x-webhook-secret,
    // segredo fixo — admin/loja digitando o código que o motoboy reportou)
    // ou app do entregador (JWT do próprio Supabase Auth — 2026-09-16,
    // validação de código de entrega direto no app). Não dá pra pedir o
    // app embutir o x-webhook-secret: é um valor fixo dentro do .apk
    // compilado, extraível por qualquer um que descompile o app. Com JWT,
    // cada chamada fica presa a um entregador real (revogável, expira) e
    // ainda checamos abaixo que ele só valida o PRÓPRIO pedido.
    const secret = req.headers.get("x-webhook-secret");
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const autorizadoPainel = secret === WEBHOOK_SECRET;
    let entregadorId: string | null = null;
    if (!autorizadoPainel) {
      if (!bearerToken) return json({ error: "Unauthorized" }, 401);
      const { data: userData, error: userErr } = await supabase.auth.getUser(bearerToken);
      if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
      entregadorId = userData.user.id;
    }

    let body: { action?: string; pedido_id?: string; code?: string };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    const { action, pedido_id, code } = body;
    if (!action || !pedido_id || !code) return json({ error: "action, pedido_id e code são obrigatórios" }, 400);
    if (action !== "coleta" && action !== "entrega") return json({ error: `action desconhecida: ${action}` }, 400);
    // App do entregador só valida código de ENTREGA (o que o cliente informa
    // na porta) — código de COLETA continua exclusivo do painel/admin, fora
    // do escopo desta mudança.
    if (!autorizadoPainel && action !== "entrega") {
      return json({ error: "Este tipo de validação só pode ser feita pelo painel" }, 403);
    }

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos").select("id, ifood_order_id, origem, motoboy_id, entregador_id").eq("id", pedido_id).limit(1).maybeSingle();
    if (pedidoErr) return json({ error: "Falha ao buscar pedido", detail: pedidoErr.message }, 500);
    if (!pedido || pedido.origem !== "ifood" || !pedido.ifood_order_id) {
      return json({ error: "Pedido não é um pedido do iFood (ou não tem ifood_order_id)" }, 400);
    }
    // Chamada via JWT só pode validar o código do pedido que é realmente
    // dele — sem isso, qualquer entregador autenticado poderia validar (e
    // queimar a tentativa) do código de entrega de um pedido de outro.
    if (!autorizadoPainel && pedido.motoboy_id !== entregadorId && pedido.entregador_id !== entregadorId) {
      return json({ error: "Este pedido não está atribuído a você" }, 403);
    }

    const token = await getAccessToken();
    if (!token) return json({ error: "Sem token de acesso ao iFood" }, 502);

    if (action === "entrega") {
      const falha = await enviarFilaPendente(pedido.id, pedido.ifood_order_id, token);
      if (falha) {
        return json({
          error: `O iFood ainda não recebeu a atualização da entrega (${falha.evento}). Tente de novo em instantes.`,
          detail: falha.erro,
        }, 409);
      }
    }

    const endpoint = action === "coleta" ? "validatePickupCode" : "verifyDeliveryCode";
    const codeEnviado = String(code).trim();
    const res = await fetch(`${IFOOD_BASE_URL}/order/v1.0/orders/${pedido.ifood_order_id}/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code: codeEnviado }),
    });
    if (res.status === 429) return json({ error: "Rate limit do iFood — tenta de novo em instantes" }, 429);
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      const traduzido = traduzirErroIfood(res.status, bodyText);
      await logErro("validar_codigo_http", {
        pedidoId: pedido_id, action, status: res.status, body: bodyText, codeEnviado, tipoCode: typeof code,
      });
      return json({ error: traduzido.error, ifoodCode: traduzido.ifoodCode, detail: bodyText }, traduzido.http);
    }

    const campoValidado = action === "coleta" ? "ifood_pickup_validado_em" : "ifood_entrega_validada_em";
    const { error: updateErr } = await supabase.from("pedidos").update({ [campoValidado]: new Date().toISOString() }).eq("id", pedido.id);
    if (updateErr) return json({ error: "Código validado no iFood mas falhou ao gravar localmente", detail: updateErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: "Erro interno inesperado", detail: String(e) }, 500);
  }
});
