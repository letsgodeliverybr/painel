import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Item 11 do checklist de homologação: antes de qualquer cancelamento de
// pedido do iFood, consultar /cancellationReasons pra pegar os motivos
// válidos e deixar o usuário escolher — não dá mais pra só virar
// pedidos.status='cancelado' localmente feito antes (fluxo puramente local,
// sem avisar o iFood de nada).
//
// Chamada a partir do app.js com o mesmo padrão de auth já usado no
// projeto (x-webhook-secret) em vez de JWT por usuário — ver
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
  if (error) console.error(`[ifood-cancelamento] FALHA AO GRAVAR LOG DE ERRO (${fonte}):`, error.message, detalhes);
}

async function upsertConfig(chave: string, valor: string) {
  const { data, error: selErr } = await supabase.from("configuracoes").select("chave").eq("chave", chave).limit(1);
  if (selErr) { await logErro("config_ler", { chave, message: selErr.message }); return; }
  const { error: writeErr } = (data && data.length > 0)
    ? await supabase.from("configuracoes").update({ valor }).eq("chave", chave)
    : await supabase.from("configuracoes").insert({ chave, valor });
  if (writeErr) await logErro("config_gravar", { chave, message: writeErr.message });
}

// Mesmo cache de token usado em ifood-polling/ifood-status-sync, duplicado
// aqui pelo mesmo motivo do resto do projeto (nenhuma function compartilha
// módulo).
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

    let body: { action?: string; pedido_id?: string; reason?: string };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    const { action, pedido_id, reason } = body;
    if (!action || !pedido_id) return json({ error: "action e pedido_id são obrigatórios" }, 400);

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos").select("id, ifood_order_id, origem").eq("id", pedido_id).limit(1).maybeSingle();
    if (pedidoErr) return json({ error: "Falha ao buscar pedido", detail: pedidoErr.message }, 500);
    if (!pedido || pedido.origem !== "ifood" || !pedido.ifood_order_id) {
      return json({ error: "Pedido não é um pedido do iFood (ou não tem ifood_order_id)" }, 400);
    }

    const token = await getAccessToken();
    if (!token) return json({ error: "Sem token de acesso ao iFood" }, 502);

    if (action === "motivos") {
      // Nome exato dos campos da resposta (code/description vs
      // cancellationCode) não pôde ser confirmado contra uma chamada real
      // ainda (app de produção travado em 403 no momento desta
      // implementação) — aceita as duas variantes até confirmar contra um
      // pedido de teste real.
      const res = await fetch(`${IFOOD_BASE_URL}/order/v1.0/orders/${pedido.ifood_order_id}/cancellationReasons`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const bodyText = await res.text();
      if (!res.ok) {
        await logErro("cancellation_reasons_http", { pedidoId: pedido_id, status: res.status, body: bodyText });
        return json({ error: "Falha ao buscar motivos de cancelamento", detail: bodyText }, 502);
      }
      let parsed: any;
      try { parsed = JSON.parse(bodyText); } catch { return json({ error: "Resposta inválida do iFood" }, 502); }
      const lista = Array.isArray(parsed) ? parsed : parsed?.reasons ?? [];
      const motivos = lista.map((r: any) => ({
        code: r.cancellationCode ?? r.code ?? r.reason,
        description: r.description ?? r.reason ?? String(r.cancellationCode ?? r.code ?? ""),
      }));
      return json({ ok: true, motivos });
    }

    if (action === "cancelar") {
      if (!reason) return json({ error: "reason é obrigatório" }, 400);
      const res = await fetch(`${IFOOD_BASE_URL}/order/v1.0/orders/${pedido.ifood_order_id}/requestCancellation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        await logErro("request_cancellation_http", { pedidoId: pedido_id, status: res.status, body: bodyText });
        return json({ error: "Falha ao solicitar cancelamento", detail: bodyText }, 502);
      }
      // Não altera pedidos.status aqui — o iFood confirma o cancelamento de
      // forma assíncrona via evento CAN (polling/webhook), que já é tratado
      // em ifood-polling/ifood-status-sync (processarEventoPedido /
      // processarEventoWebhook). Virar o status aqui seria otimista demais:
      // o iFood pode recusar o pedido de cancelamento.
      return json({ ok: true, motivo: "Cancelamento solicitado — aguardando confirmação do iFood" });
    }

    return json({ error: `action desconhecida: ${action}` }, 400);
  } catch (e) {
    return json({ error: "Erro interno inesperado", detail: String(e) }, 500);
  }
});
