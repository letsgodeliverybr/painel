// Open Delivery v1.7.1 — Let's Go como operador logístico (Logistics Service).
// ETAPA 2: autenticação (POST /oauth/token).
// ETAPA 3: POST /v1/logistics/delivery e GET /v1/logistics/delivery/{orderId}.
// A loja vem SEMPRE do token. Regras de negócio e taxa ficam no banco
// (od_criar_entrega / od_consultar_entrega). Função NOVA, separada das do iFood.
// Base URL do parceiro: https://<projeto>.supabase.co/functions/v1/open-delivery
// Nunca grava nem loga client_secret ou access_token: só hashes SHA-256.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TOKEN_TTL_SEG = 3600; // 1h; sem refresh token (especificação)

// Erros no formato da especificação: { title, status }
function erro(status: number, title: string): Response {
  return new Response(JSON.stringify({ title, status }), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function tokenAleatorio(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// IP do cliente para o bloqueio por tentativas falhas. cf-connecting-ip é
// posto pela borda (o cliente não consegue forjar); x-forwarded-for só como
// reserva. O bloqueio por client_id tentado não depende do IP.
function ipDe(req: Request): string {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip")
    ?? (req.headers.get("x-forwarded-for") ?? "").split(",")[0];
  return ip.trim().slice(0, 64);
}

// Caminho depois de /functions/v1/open-delivery (ex: "/oauth/token")
function rota(req: Request): string {
  const p = new URL(req.url).pathname;
  const i = p.indexOf("/open-delivery");
  return (i >= 0 ? p.slice(i + "/open-delivery".length) : p) || "/";
}

// Token Bearer -> credencial e loja (nunca do corpo da requisição)
async function autenticar(req: Request): Promise<{ credencial_id: string; loja_id: string } | null> {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+([A-Za-z0-9_\-]{20,200})$/);
  if (!m) return null;
  const { data, error } = await supabase.rpc("od_validar_token", { p_token_hash: await sha256Hex(m[1]) });
  if (error || !Array.isArray(data) || !data[0]) return null;
  return data[0];
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

// Distância de rota (km), mesma fonte do painel (Google Routes). Primeiro o
// cache (30 dias, por par de pontos ~11 m); só chama o Google se não houver.
// A chave GOOGLE_ROUTES_KEY é segredo da função: só vai no cabeçalho da
// chamada ao Google, nunca em log, resposta ou banco.
// Se falhar: OD_FATOR_RETA (ex: "1.4") = linha reta x fator; sem ela, 503.
async function distanciaRotaKm(lat1: number, lng1: number, lat2: number, lng2: number): Promise<number | null> {
  const { data: cache } = await supabase.rpc("od_rota_cache_buscar", { olat: lat1, olng: lng1, dlat: lat2, dlng: lng2 });
  if (typeof cache === "number" || (typeof cache === "string" && cache !== "")) return Number(cache);
  const key = Deno.env.get("GOOGLE_ROUTES_KEY");
  if (!key) return null;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.distanceMeters" },
      body: JSON.stringify({ origin: { location: { latLng: { latitude: lat1, longitude: lng1 } } },
        destination: { location: { latLng: { latitude: lat2, longitude: lng2 } } }, travelMode: "TWO_WHEELER" }),
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const d = await r.json();
    const m = d?.routes?.[0]?.distanceMeters;
    if (typeof m !== "number") return null;
    const km = Math.round(m / 10) / 100;
    await supabase.rpc("od_rota_cache_gravar", { olat: lat1, olng: lng1, dlat: lat2, dlng: lng2, p_km: km });
    return km;
  } catch { return null; }
}

async function criarEntrega(req: Request, auth: { credencial_id: string; loja_id: string }): Promise<Response> {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return erro(400, "invalid_content_type");
  const texto = await req.text();
  if (texto.length > 64_000) return erro(400, "payload_too_large");
  let body: any;
  try { body = JSON.parse(texto); } catch { return erro(400, "invalid_json"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return erro(400, "invalid_json");
  // distância loja -> cliente (coordenadas da loja vêm do cadastro, no banco)
  let km: number | null = null;
  const lat = Number(body?.deliveryAddress?.latitude), lng = Number(body?.deliveryAddress?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const { data: loja } = await supabase.from("lojas").select("latitude,longitude").eq("id", auth.loja_id).single();
    if (loja?.latitude && loja?.longitude) km = await distanciaRotaKm(Number(loja.latitude), Number(loja.longitude), lat, lng);
  }
  const fator = Number(Deno.env.get("OD_FATOR_RETA") ?? "");
  const { data, error } = await supabase.rpc("od_criar_entrega", {
    p_credencial_id: auth.credencial_id, p_loja_id: auth.loja_id, p_body: body, p_distancia_km: km,
    p_fator_reta: Number.isFinite(fator) && fator >= 1 && fator <= 3 ? fator : null, p_ip: ipDe(req),
  });
  if (error || !data) return erro(503, "service_unavailable");
  return json(data.status, data.body);
}

async function consultarEntrega(req: Request, auth: { credencial_id: string; loja_id: string }, orderId: string): Promise<Response> {
  const { data, error } = await supabase.rpc("od_consultar_entrega", {
    p_credencial_id: auth.credencial_id, p_loja_id: auth.loja_id, p_order_id: orderId, p_ip: ipDe(req),
  });
  if (error || !data) return erro(503, "service_unavailable");
  return json(data.status, data.body);
}

async function oauthToken(req: Request): Promise<Response> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/x-www-form-urlencoded")) return erro(401, "invalid_request");
  let form: URLSearchParams;
  try { form = new URLSearchParams(await req.text()); } catch { return erro(401, "invalid_request"); }
  const grant = form.get("grant_type");
  const clientId = (form.get("client_id") ?? "").trim();
  const clientSecret = form.get("client_secret") ?? "";
  if (grant !== "client_credentials") return erro(401, "unsupported_grant_type");
  if (!clientId || !clientSecret || clientId.length > 100 || clientSecret.length > 200) return erro(401, "invalid_client");

  const token = tokenAleatorio();
  const { data, error } = await supabase.rpc("od_emitir_token", {
    p_client_id: clientId,
    p_secret_hash: await sha256Hex(clientSecret),
    p_token_hash: await sha256Hex(token),
    p_ip: ipDe(req),
    p_ttl_seg: TOKEN_TTL_SEG,
  });
  if (error) return erro(503, "service_unavailable");
  if (data?.status === 429) return erro(429, "too_many_requests");
  if (!data?.ok) return erro(401, "invalid_client");
  return new Response(JSON.stringify({ access_token: token, token_type: "bearer", expires_in: TOKEN_TTL_SEG }), {
    status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

serve(async (req) => {
  try {
    const r = rota(req);
    if (req.method === "POST" && r === "/oauth/token") return await oauthToken(req);
    const mGet = r.match(/^\/v1\/logistics\/delivery\/([^/]{1,100})$/);
    if ((req.method === "POST" && r === "/v1/logistics/delivery") || (req.method === "GET" && mGet)) {
      const auth = await autenticar(req);
      if (!auth) return erro(401, "unauthorized");
      if (req.method === "POST") return await criarEntrega(req, auth);
      return await consultarEntrega(req, auth, decodeURIComponent(mGet![1]));
    }
    return erro(404, "not_found");
  } catch {
    return erro(503, "service_unavailable");
  }
});
