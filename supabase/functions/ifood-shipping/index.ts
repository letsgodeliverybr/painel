import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Módulo Shipping do iFood (diferente do módulo Order já usado no resto do
// projeto) — pedido do usuário 2026-09-19, parte do seletor "Sobre
// Demanda" (Uber + iFood). Só funciona pra pedidos que já existem DENTRO
// da plataforma iFood (tem ifood_order_id) — doc oficial: "request iFood
// delivery drivers for orders that already exist on the platform". Não
// serve pra pedido de loja própria — o app.js já garante isso não
// oferecendo essa opção quando origem != 'ifood'.
//
// Credenciais confirmadas contra a API real em 2026-09-19 (não só doc):
// as mesmas IFOOD_CLIENT_ID/IFOOD_CLIENT_SECRET do módulo Order já
// funcionam aqui — testado com um pedido real cancelado, retornou 400
// OrderStatusInvalid (erro de regra de negócio, não 401/403 de permissão),
// confirmando que o token é aceito pelo módulo Shipping sem precisar de
// nada novo no Portal do Parceiro.
//
// Payload de deliveryAvailabilities confirmado contra a doc oficial
// (developer.ifood.com.br/docs/food/guides/modules/shipping/inside,
// 2026-09-19): campo "id" é o quoteId, preço em quote.netValue. Nunca
// visto contra uma resposta 200 real ainda (só tivemos pedidos cancelados
// pra testar) — por isso loga o corpo bruto sempre, pra ajustar depois se
// algum nome de campo estiver diferente do documentado.
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
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

async function logErro(fonte: string, detalhes: Record<string, unknown>) {
  const { error } = await supabase.from("logs_acoes").insert({ acao: `ifood_shipping_${fonte}`, detalhes });
  if (error) console.error(`[ifood-shipping] FALHA AO GRAVAR LOG (${fonte}):`, error.message, detalhes);
}

async function upsertConfig(chave: string, valor: string) {
  const { data } = await supabase.from("configuracoes").select("chave").eq("chave", chave).limit(1);
  if (data && data.length > 0) await supabase.from("configuracoes").update({ valor }).eq("chave", chave);
  else await supabase.from("configuracoes").insert({ chave, valor });
}

// Mesmo cache de token em `configuracoes` já usado pelas outras functions
// do módulo Order (ifood-polling, ifood-cancelamento etc.) — o token OAuth
// do iFood não é por módulo, é da aplicação inteira, então reaproveita a
// mesma chave de cache.
async function getAccessToken(): Promise<string | null> {
  const { data: cfg } = await supabase
    .from("configuracoes").select("chave, valor").in("chave", ["ifood_access_token", "ifood_token_expires_at"]);
  const cache: Record<string, string> = {};
  for (const c of cfg || []) cache[c.chave] = c.valor;
  const expiraEm = cache["ifood_token_expires_at"] ? new Date(cache["ifood_token_expires_at"]) : null;
  const aindaValido = !!expiraEm && expiraEm.getTime() - Date.now() > 5 * 60 * 1000;
  if (aindaValido && cache["ifood_access_token"]) return cache["ifood_access_token"];
  if (!IFOOD_CLIENT_ID || !IFOOD_CLIENT_SECRET) {
    await logErro("auth_credenciais_ausentes", {});
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
    const respJson = JSON.parse(bodyText);
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

    let body: { action?: string; pedido_id?: string };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const { action, pedido_id } = body;
    if (!action || !pedido_id) return json({ error: "action e pedido_id são obrigatórios" }, 400);

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos").select("id, numero, ifood_order_id, ifood_shipping_quote_id").eq("id", pedido_id).maybeSingle();
    if (pedidoErr) return json({ error: "Falha ao buscar pedido", detail: pedidoErr.message }, 500);
    if (!pedido || !pedido.ifood_order_id) {
      return json({ error: "Pedido não tem ifood_order_id — Shipping só funciona pra pedidos que existem na plataforma iFood" }, 400);
    }

    const token = await getAccessToken();
    if (!token) return json({ error: "Sem token de acesso ao iFood" }, 502);
    const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    if (action === "cotar") {
      const res = await fetch(`${IFOOD_BASE_URL}/shipping/v1.0/orders/${pedido.ifood_order_id}/deliveryAvailabilities`, {
        method: "GET",
        headers: authHeaders,
      });
      const bodyText = await res.text();
      await logErro("cotacao_bruta", { pedidoId: pedido_id, status: res.status, body: bodyText });

      if (!res.ok) {
        // Erros documentados (HighDemand, OffOpeningHours, DeliveryDistanceTooHigh
        // etc.) são indisponibilidade de negócio, não falha técnica — devolve
        // ok:true/disponivel:false pro app.js mostrar "Indisponível" na lista,
        // não tratar como erro genérico.
        let code = "erro_desconhecido";
        try { code = JSON.parse(bodyText)?.code ?? code; } catch { /* noop */ }
        return json({ ok: true, disponivel: false, motivo: code });
      }

      let quote: any;
      try { quote = JSON.parse(bodyText); } catch { return json({ error: "Resposta de cotação inválida" }, 502); }
      const quoteId = quote.id;
      const preco = quote.quote?.netValue ?? quote.quote?.grossValue;
      if (!quoteId) { await logErro("cotacao_sem_id", { pedidoId: pedido_id, body: bodyText }); return json({ error: "Cotação sem ID" }, 502); }

      await supabase.from("pedidos").update({
        ifood_shipping_quote_id: quoteId,
        ifood_shipping_status: "cotado",
        ifood_shipping_preco: preco ?? null,
        ifood_shipping_atualizado_em: new Date().toISOString(),
      }).eq("id", pedido_id);

      return json({ ok: true, disponivel: true, quoteId, preco });
    }

    if (action === "solicitar") {
      const quoteId = pedido.ifood_shipping_quote_id;
      if (!quoteId) return json({ error: "Sem cotação ativa — cote de novo antes de solicitar" }, 400);

      const res = await fetch(`${IFOOD_BASE_URL}/shipping/v1.0/orders/${pedido.ifood_order_id}/requestDriver`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ quoteId }),
      });
      const bodyText = await res.text().catch(() => "");
      if (res.status !== 202 && !res.ok) {
        await logErro("solicitar_http", { pedidoId: pedido_id, status: res.status, body: bodyText });
        return json({ error: "Falha ao solicitar motorista iFood", detail: bodyText }, 502);
      }

      await supabase.from("pedidos").update({
        ifood_shipping_status: "solicitado",
        ifood_shipping_atualizado_em: new Date().toISOString(),
      }).eq("id", pedido_id);

      // Confirmação de sucesso/falha é assíncrona — chega via evento
      // REQUEST_DRIVER_SUCCESS/REQUEST_DRIVER_FAILED no mesmo polling de
      // eventos do módulo Order (ifood-polling/ifood-status-sync), não
      // aqui. Ver processarEventoPedido nesses dois arquivos.
      return json({ ok: true, motivo: "Motorista iFood solicitado — aguardando confirmação" });
    }

    if (action === "cancelar") {
      const res = await fetch(`${IFOOD_BASE_URL}/shipping/v1.0/orders/${pedido.ifood_order_id}/cancelRequestDriver`, {
        method: "POST",
        headers: authHeaders,
      });
      const bodyText = await res.text().catch(() => "");
      if (!res.ok) {
        await logErro("cancelar_http", { pedidoId: pedido_id, status: res.status, body: bodyText });
        return json({ error: "Falha ao cancelar solicitação", detail: bodyText }, 502);
      }
      await supabase.from("pedidos").update({
        ifood_shipping_status: "cancelado",
        ifood_shipping_atualizado_em: new Date().toISOString(),
      }).eq("id", pedido_id);
      return json({ ok: true });
    }

    return json({ error: `action desconhecida: ${action}` }, 400);
  } catch (e) {
    return json({ error: "Erro interno inesperado", detail: String(e) }, 500);
  }
});
