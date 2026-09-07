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
// o motoboy reportou) — não existe UI no app do entregador pra isso ainda,
// fora do escopo desta mudança (ver relatório).
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const secret = req.headers.get("x-webhook-secret");
    if (secret !== WEBHOOK_SECRET) return json({ error: "Unauthorized" }, 401);

    let body: { action?: string; pedido_id?: string; code?: string };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    const { action, pedido_id, code } = body;
    if (!action || !pedido_id || !code) return json({ error: "action, pedido_id e code são obrigatórios" }, 400);
    if (action !== "coleta" && action !== "entrega") return json({ error: `action desconhecida: ${action}` }, 400);

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos").select("id, ifood_order_id, origem").eq("id", pedido_id).limit(1).maybeSingle();
    if (pedidoErr) return json({ error: "Falha ao buscar pedido", detail: pedidoErr.message }, 500);
    if (!pedido || pedido.origem !== "ifood" || !pedido.ifood_order_id) {
      return json({ error: "Pedido não é um pedido do iFood (ou não tem ifood_order_id)" }, 400);
    }

    const token = await getAccessToken();
    if (!token) return json({ error: "Sem token de acesso ao iFood" }, 502);

    const endpoint = action === "coleta" ? "validatePickupCode" : "verifyDeliveryCode";
    const res = await fetch(`${IFOOD_BASE_URL}/order/v1.0/orders/${pedido.ifood_order_id}/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.status === 429) return json({ error: "Rate limit do iFood — tenta de novo em instantes" }, 429);
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      await logErro("validar_codigo_http", { pedidoId: pedido_id, action, status: res.status, body: bodyText });
      return json({ error: `Código não confere ou falha na validação`, detail: bodyText }, 502);
    }

    const campoValidado = action === "coleta" ? "ifood_pickup_validado_em" : "ifood_entrega_validada_em";
    const { error: updateErr } = await supabase.from("pedidos").update({ [campoValidado]: new Date().toISOString() }).eq("id", pedido.id);
    if (updateErr) return json({ error: "Código validado no iFood mas falhou ao gravar localmente", detail: updateErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: "Erro interno inesperado", detail: String(e) }, 500);
  }
});
