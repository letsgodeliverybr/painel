import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Botão "Sobre Demanda" (card de pedido, app.js) — cota e cria uma
// entrega via Uber Direct API pra um pedido específico, sem tela de
// confirmação (pedido explícito do usuário, 2026-09-17). Mesmo padrão de
// autenticação (x-webhook-secret) das outras functions de ação de pedido
// (ifood-cancelamento, ifood-troca-endereco).
//
// IMPORTANTE — formato de pickup_address/dropoff_address ainda não
// confirmado contra uma chamada real (sandbox): a doc pública não
// detalha se aceita string simples ou exige objeto estruturado
// (street_address/city/state/zip_code). Implementado com string simples
// (endereço formatado) + latitude/longitude como campos auxiliares —
// ajustar aqui se o sandbox rejeitar, mesma metodologia usada com o
// iFood (log do erro real, corrige o campo certo).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "letsgo2026secret";
const UBER_CUSTOMER_ID = Deno.env.get("UBER_CUSTOMER_ID") ?? "";
const UBER_CLIENT_ID = Deno.env.get("UBER_CLIENT_ID") ?? "";
const UBER_CLIENT_SECRET = Deno.env.get("UBER_CLIENT_SECRET") ?? "";
const UBER_AUTH_URL = "https://auth.uber.com/oauth/v2/token";
const UBER_API_URL = "https://api.uber.com";

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
  const { error } = await supabase.from("logs_acoes").insert({ acao: `uber_erro_${fonte}`, detalhes });
  if (error) console.error(`[uber-solicitar-entrega] FALHA AO GRAVAR LOG (${fonte}):`, error.message, detalhes);
}

async function upsertConfig(chave: string, valor: string) {
  const { data } = await supabase.from("configuracoes").select("chave").eq("chave", chave).limit(1);
  if (data && data.length > 0) await supabase.from("configuracoes").update({ valor }).eq("chave", chave);
  else await supabase.from("configuracoes").insert({ chave, valor });
}

// Token Uber dura 30 dias (bem mais folgado que o do iFood) — mesmo
// padrão de cache em `configuracoes` já usado pro iFood.
async function getUberToken(): Promise<string | null> {
  const { data: cfg } = await supabase.from("configuracoes").select("chave, valor").in("chave", ["uber_access_token", "uber_token_expires_at"]);
  const cache: Record<string, string> = {};
  for (const c of cfg || []) cache[c.chave] = c.valor;
  const expiraEm = cache["uber_token_expires_at"] ? new Date(cache["uber_token_expires_at"]) : null;
  if (expiraEm && expiraEm.getTime() - Date.now() > 60 * 60 * 1000 && cache["uber_access_token"]) return cache["uber_access_token"];

  if (!UBER_CLIENT_ID || !UBER_CLIENT_SECRET) {
    await logErro("auth_credenciais_ausentes", { temClientId: !!UBER_CLIENT_ID, temClientSecret: !!UBER_CLIENT_SECRET });
    return null;
  }
  try {
    const res = await fetch(UBER_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: UBER_CLIENT_ID, client_secret: UBER_CLIENT_SECRET, grant_type: "client_credentials", scope: "eats.deliveries" }),
    });
    const bodyText = await res.text();
    if (!res.ok) { await logErro("auth_http", { status: res.status, body: bodyText }); return null; }
    const respJson = JSON.parse(bodyText);
    const token = respJson.access_token;
    const expiresInSec = respJson.expires_in ?? 30 * 24 * 60 * 60;
    if (!token) { await logErro("auth_resposta_sem_token", { body: bodyText }); return null; }
    await upsertConfig("uber_access_token", token);
    await upsertConfig("uber_token_expires_at", new Date(Date.now() + expiresInSec * 1000).toISOString());
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

    if (!UBER_CUSTOMER_ID) return json({ error: "UBER_CUSTOMER_ID não configurado" }, 500);

    let body: { pedido_id?: string; action?: string };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const { pedido_id, action } = body;
    if (!pedido_id) return json({ error: "pedido_id é obrigatório" }, 400);
    // action:"cotar" faz só a cotação (sem criar entrega, sem cobrar nada) —
    // usado pra checar se a conta Uber ainda está bloqueada (ex:
    // tax_form_required) antes de rodar o fluxo completo de verdade.
    const somenteCotar = action === "cotar";

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .select("id, numero, endereco, latitude, longitude, endereco_coleta, latitude_coleta, longitude_coleta, contato_coleta, telefone_coleta, cliente, telefone, itens, valor, loja_id")
      .eq("id", pedido_id).maybeSingle();
    if (pedidoErr) return json({ error: "Falha ao buscar pedido", detail: pedidoErr.message }, 500);
    if (!pedido) return json({ error: "Pedido não encontrado" }, 404);

    let loja: { nome: string; endereco: string; latitude: number | null; longitude: number | null; telefone: string | null } | null = null;
    if (pedido.loja_id) {
      const { data: lojaData } = await supabase.from("lojas").select("nome, endereco, latitude, longitude, telefone").eq("id", pedido.loja_id).maybeSingle();
      loja = lojaData;
    }

    const enderecoColeta = pedido.endereco_coleta || loja?.endereco;
    const latColeta = pedido.latitude_coleta ?? loja?.latitude;
    const lngColeta = pedido.longitude_coleta ?? loja?.longitude;
    const nomeColeta = pedido.contato_coleta || loja?.nome || "Loja";
    const telefoneColeta = pedido.telefone_coleta || loja?.telefone;
    if (!enderecoColeta || !pedido.endereco) {
      return json({ error: "Pedido ou loja sem endereço cadastrado — não é possível cotar" }, 400);
    }

    const token = await getUberToken();
    if (!token) return json({ error: "Sem token de acesso à Uber" }, 502);

    const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // 1. Cotação
    const quoteBody = {
      pickup_address: enderecoColeta,
      dropoff_address: pedido.endereco,
      pickup_latitude: latColeta ?? undefined,
      pickup_longitude: lngColeta ?? undefined,
      dropoff_latitude: pedido.latitude ?? undefined,
      dropoff_longitude: pedido.longitude ?? undefined,
    };
    const quoteRes = await fetch(`${UBER_API_URL}/v1/customers/${UBER_CUSTOMER_ID}/delivery_quotes`, {
      method: "POST", headers: authHeaders, body: JSON.stringify(quoteBody),
    });
    const quoteBodyText = await quoteRes.text();
    if (!quoteRes.ok) {
      await logErro("cotacao_http", { pedidoId: pedido_id, status: quoteRes.status, body: quoteBodyText, enviado: quoteBody });
      return json({ error: "Falha ao cotar entrega na Uber", detail: quoteBodyText }, 502);
    }
    let quote: any;
    try { quote = JSON.parse(quoteBodyText); } catch { return json({ error: "Resposta de cotação inválida" }, 502); }
    const quoteId = quote.id ?? quote.quote_id;
    if (!quoteId) { await logErro("cotacao_sem_id", { pedidoId: pedido_id, body: quoteBodyText }); return json({ error: "Cotação sem ID" }, 502); }

    await supabase.from("pedidos").update({ uber_quote_id: quoteId, uber_status: "cotado" }).eq("id", pedido_id);

    if (somenteCotar) return json({ ok: true, quote });

    // 2. Criar entrega
    const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
    const manifestItems = itens.length
      ? itens.map((it: any) => ({ name: it?.nome || it?.name || "Item", quantity: it?.quantidade || it?.quantity || 1 }))
      : [{ name: `Pedido #${pedido.numero}`, quantity: 1 }];

    const deliveryBody = {
      quote_id: quoteId,
      pickup_address: enderecoColeta,
      pickup_name: nomeColeta,
      pickup_phone_number: telefoneColeta || "",
      dropoff_address: pedido.endereco,
      dropoff_name: pedido.cliente || "Cliente",
      dropoff_phone_number: pedido.telefone || "",
      manifest_items: manifestItems,
    };
    const deliveryRes = await fetch(`${UBER_API_URL}/v1/customers/${UBER_CUSTOMER_ID}/deliveries`, {
      method: "POST", headers: authHeaders, body: JSON.stringify(deliveryBody),
    });
    const deliveryBodyText = await deliveryRes.text();
    if (!deliveryRes.ok) {
      await logErro("criar_entrega_http", { pedidoId: pedido_id, status: deliveryRes.status, body: deliveryBodyText, enviado: deliveryBody });
      await supabase.from("pedidos").update({ uber_status: "erro_criar_entrega" }).eq("id", pedido_id);
      return json({ error: "Falha ao criar entrega na Uber", detail: deliveryBodyText }, 502);
    }
    let delivery: any;
    try { delivery = JSON.parse(deliveryBodyText); } catch { return json({ error: "Resposta de criação de entrega inválida" }, 502); }

    // 3. Salva no pedido
    const { error: updateErr } = await supabase.from("pedidos").update({
      uber_delivery_id: delivery.id ?? null,
      uber_tracking_url: delivery.tracking_url ?? null,
      uber_status: "criado",
      uber_delivery_status: delivery.status ?? null,
      uber_atualizado_em: new Date().toISOString(),
      uber_solicitado_em: new Date().toISOString(),
    }).eq("id", pedido_id);
    if (updateErr) return json({ error: "Entrega criada na Uber mas falhou ao gravar localmente", detail: updateErr.message }, 500);

    return json({ ok: true, delivery_id: delivery.id, tracking_url: delivery.tracking_url });
  } catch (e) {
    return json({ error: "Erro interno inesperado", detail: String(e) }, 500);
  }
});
