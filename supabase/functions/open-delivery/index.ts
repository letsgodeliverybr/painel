// Open Delivery v1.7.1 — Let's Go como operador logístico (Logistics Service).
// ETAPA 2: autenticação (POST /oauth/token).
// ETAPA 3: POST /v1/logistics/delivery e GET /v1/logistics/delivery/{orderId}.
// ETAPA 4: POST /interno/eventos (só o agendamento, com a chave de serviço):
//          envia a fila od_eventos para o webhook /deliveryEvent do parceiro.
// ETAPA 6b: POST /v1/logistics/cancel/{orderId}.
// A loja vem SEMPRE do token. Regras de negócio e taxa ficam no banco
// (od_criar_entrega / od_consultar_entrega). Função NOVA, separada das do iFood.
// Base URL do parceiro: https://opendelivery.letsgodelivery.com.br/functions/v1/open-delivery
// (custom domain do Supabase; https://<projeto>.supabase.co/... continua valendo)
// Nunca grava nem loga client_secret ou access_token: só hashes SHA-256.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hmacSha256Hex, ipBloqueado, urlWebhookOk } from "./seguranca.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TOKEN_TTL_SEG = 3600; // 1h; sem refresh token (especificação)

// Erros no formato da especificação: { title, status }
function erro(status: number, title: string, detail?: string): Response {
  return new Response(JSON.stringify(detail ? { title, status, detail } : { title, status }), {
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

// Host público chamado pelo parceiro (custom domain ou supabase.co). Só vai
// para od_acessos.host, via cabeçalho x-od-host lido pelo trigger no banco.
function hostDe(req: Request): string {
  const h = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  return h.split(",")[0].trim().toLowerCase().slice(0, 100);
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

// vehicle: o Open Delivery 1.7.1 exige vehicle {type, container}, mas o
// Let's Go só opera moto. Sem vehicle (ou sem type) assume moto com bag;
// sem container assume NORMAL. Tipo informado e sem moto (ex: só CAR)
// continua 422 vehicle_not_supported no od_criar_entrega.
function veiculoComPadrao(body: any): void {
  const v = body.vehicle;
  if (v === undefined || v === null) { body.vehicle = { type: ["MOTORBIKE_BAG"], container: "NORMAL" }; return; }
  if (typeof v !== "object" || Array.isArray(v)) return; // formato inválido: 400 no banco
  const semTipo = v.type === undefined || v.type === null || (Array.isArray(v.type) && v.type.length === 0);
  body.vehicle = { ...v, type: semTipo ? ["MOTORBIKE_BAG"] : v.type, container: v.container ?? "NORMAL" };
}

// Endereço sem latitude/longitude (opcionais no Open Delivery 1.7.1): o
// Let's Go geocodifica pelo Google Geocoding. Só aceita resultado preciso,
// porque a coordenada define a distância e o preço da entrega; qualquer
// dúvida vira 422 com motivo, nunca um ponto "aproximado".
// A chave GOOGLE_GEOCODING_KEY é segredo da função: só vai na URL da
// chamada ao Google, nunca em log, resposta ou banco.
const TIPOS_PRECISOS = ["street_address", "premise", "subpremise"];
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const componente = (r: any, tipo: string) => r.address_components?.find((c: any) => c.types?.includes(tipo));

type Geo = { lat: number; lng: number } | { status: number; title: string; detail: string };

async function geocodificar(da: any, key: string): Promise<Geo> {
  const rua = String(da?.street ?? "").trim(), numero = String(da?.number ?? "").trim();
  const cidade = String(da?.city ?? "").trim(), uf = String(da?.state ?? "").trim();
  const cep = String(da?.postalCode ?? "").replace(/\D/g, "");
  if (!rua || !/\d/.test(numero) || !cidade || !uf) {
    return { status: 422, title: "address_incomplete",
      detail: "Sem latitude/longitude, informe street, number (com dígito), city e state em deliveryAddress." };
  }
  const endereco = [`${rua}, ${numero}`, da?.district, cidade, uf, cep, "Brasil"].filter(Boolean).join(", ");
  const comps = ["country:BR", cep.length === 8 ? `postal_code:${cep}` : ""].filter(Boolean).join("|");
  let d: any;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco)}` +
      `&components=${encodeURIComponent(comps)}&region=br&language=pt-BR&key=${key}`, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    d = await r.json();
  } catch {
    return { status: 503, title: "geocoding_unavailable", detail: "Não foi possível localizar o endereço agora. Tente de novo ou envie latitude/longitude." };
  }
  // Erro do Google (limite, chave recusada) também vem sem resultados: só
  // ZERO_RESULTS é "endereço não existe"; o resto é 503, o parceiro tenta de novo.
  if (d?.status !== "OK" && d?.status !== "ZERO_RESULTS") {
    return { status: 503, title: "geocoding_unavailable", detail: "Não foi possível localizar o endereço agora. Tente de novo ou envie latitude/longitude." };
  }
  if (!d.results?.length) {
    return { status: 422, title: "address_not_found", detail: "Endereço não encontrado. Confira os dados ou envie latitude/longitude." };
  }
  const r = d.results[0];
  const motivos: string[] = [];
  if (d.results.length > 1) motivos.push("mais de um endereço possível");
  if (r.partial_match) motivos.push("correspondência parcial");
  if (!["ROOFTOP", "RANGE_INTERPOLATED"].includes(r.geometry?.location_type)) motivos.push("localização aproximada");
  if (!r.types?.some((t: string) => TIPOS_PRECISOS.includes(t))) motivos.push("resultado não é um endereço com número");
  const num = componente(r, "street_number")?.long_name ?? "";
  if (num.replace(/\D/g, "") !== numero.replace(/\D/g, "")) motivos.push("número diferente do informado");
  const cid = componente(r, "administrative_area_level_2") ?? componente(r, "locality");
  if (!cid || semAcento(cid.long_name) !== semAcento(cidade)) motivos.push("cidade diferente da informada");
  if (motivos.length) {
    return { status: 422, title: "low_confidence_address",
      detail: `Endereço localizado com baixa confiança (${motivos.join(", ")}). Envie latitude/longitude.` };
  }
  return { lat: r.geometry.location.lat, lng: r.geometry.location.lng };
}

async function criarEntrega(req: Request, auth: { credencial_id: string; loja_id: string }): Promise<Response> {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return erro(400, "invalid_content_type");
  const texto = await req.text();
  if (texto.length > 64_000) return erro(400, "payload_too_large");
  let body: any;
  try { body = JSON.parse(texto); } catch { return erro(400, "invalid_json"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return erro(400, "invalid_json");
  veiculoComPadrao(body);
  // Sem GOOGLE_GEOCODING_KEY nada muda: o banco responde 422
  // invalid_delivery_coordinates, igual a antes.
  const geoKey = Deno.env.get("GOOGLE_GEOCODING_KEY");
  const da = body.deliveryAddress;
  if (geoKey && da && typeof da === "object" && !Array.isArray(da) && (da.latitude == null || da.longitude == null)) {
    const g = await geocodificar(da, geoKey);
    if ("title" in g) return erro(g.status, g.title, g.detail);
    da.latitude = g.lat; da.longitude = g.lng;
  }
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
  }).setHeader("x-od-host", hostDe(req));
  if (error || !data) return erro(503, "service_unavailable");
  return json(data.status, data.body);
}

async function consultarEntrega(req: Request, auth: { credencial_id: string; loja_id: string }, orderId: string): Promise<Response> {
  const { data, error } = await supabase.rpc("od_consultar_entrega", {
    p_credencial_id: auth.credencial_id, p_loja_id: auth.loja_id, p_order_id: orderId, p_ip: ipDe(req),
  }).setHeader("x-od-host", hostDe(req));
  if (error || !data) return erro(503, "service_unavailable");
  return json(data.status, data.body);
}

async function cancelarEntrega(req: Request, auth: { credencial_id: string; loja_id: string }, orderId: string): Promise<Response> {
  let body: any = {};
  const texto = await req.text();
  if (texto.length > 8_000) return erro(400, "payload_too_large");
  if (texto) { try { body = JSON.parse(texto); } catch { return erro(400, "invalid_json"); } }
  const { data, error } = await supabase.rpc("od_cancelar_entrega", {
    p_credencial_id: auth.credencial_id, p_loja_id: auth.loja_id, p_order_id: orderId, p_body: body, p_ip: ipDe(req),
  }).setHeader("x-od-host", hostDe(req));
  if (error || !data) return erro(503, "service_unavailable");
  return json(data.status, data.body);
}

// ── ETAPA 4: envio do webhook ────────────────────────────────────────────
const APP_ID_LETSGO = Deno.env.get("OD_APP_ID") ?? ""; // nosso AppId (não é segredo)

// Anti-SSRF: regras da URL + TODOS os IPs do DNS precisam ser públicos.
async function destinoSeguro(url: string): Promise<string | null> {
  const r = urlWebhookOk(url);
  if (!r.ok) return r.motivo ?? "url_invalida";
  const ips: string[] = [];
  for (const tipo of ["A", "AAAA"] as const) {
    try { ips.push(...(await Deno.resolveDns(r.host!, tipo))); } catch { /* sem registro desse tipo */ }
  }
  if (!ips.length) return "dns_sem_resposta";
  if (ips.some(ipBloqueado)) return "ip_interno";
  return null;
}

async function enviarEvento(ev: any): Promise<{ http: number; erro: string | null }> {
  const bloqueio = await destinoSeguro(ev.webhook_url);
  if (bloqueio) return { http: 0, erro: `destino bloqueado: ${bloqueio}` };
  const corpo = JSON.stringify(ev.payload);
  const assinatura = await hmacSha256Hex(ev.segredo, corpo);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch(ev.webhook_url, {
      method: "POST", redirect: "manual", signal: ctl.signal,
      headers: { "Content-Type": "application/json", "User-Agent": "LetsGo-OpenDelivery/1.0",
        "X-App-Id": APP_ID_LETSGO, "X-App-MerchantId": ev.merchant_id, "X-App-Signature": assinatura },
      body: corpo,
    });
    await r.body?.cancel();                     // corpo da resposta é ignorado
    return { http: r.status, erro: r.status >= 300 && r.status < 400 ? "redirecionamento não é seguido" : (r.ok ? null : `HTTP ${r.status}`) };
  } catch (e) {
    return { http: 0, erro: (e as Error)?.name === "AbortError" ? "timeout 5s" : "falha de conexão" };
  } finally { clearTimeout(t); }
}

// Várias passadas dentro do minuto do agendamento (0s, ~20s, ~40s)
async function processarFila(): Promise<{ enviados: number; falhas: number }> {
  let enviados = 0, falhas = 0;
  const inicio = Date.now();
  while (Date.now() - inicio < 45_000) {
    const { data, error } = await supabase.rpc("od_eventos_reservar", { p_limite: 30 });
    if (error) break;
    const lote = Array.isArray(data) ? data : [];
    // um evento por pedido por vez (a reserva já garante); pedidos diferentes em paralelo, até 5
    for (let i = 0; i < lote.length; i += 5) {
      await Promise.all(lote.slice(i, i + 5).map(async (ev: any) => {
        const r = await enviarEvento(ev);
        await supabase.rpc("od_eventos_concluir", { p_id: ev.id, p_http: r.http, p_erro: r.erro });
        if (r.http >= 200 && r.http < 300) enviados++; else falhas++;
      }));
    }
    if (Date.now() - inicio > 40_000) break;
    await new Promise((res) => setTimeout(res, lote.length ? 2_000 : 20_000));
  }
  return { enviados, falhas };
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
  }).setHeader("x-od-host", hostDe(req));
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
    if (req.method === "POST" && r === "/interno/eventos") {
      // só o agendamento (chave de serviço no cofre); qualquer outro recebe 404
      if ((req.headers.get("authorization") ?? "") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) return erro(404, "not_found");
      return json(200, await processarFila());
    }
    const mCancel = r.match(/^\/v1\/logistics\/cancel\/([^/]{1,100})$/);
    if (req.method === "POST" && mCancel) {
      const auth = await autenticar(req);
      if (!auth) return erro(401, "unauthorized");
      return await cancelarEntrega(req, auth, decodeURIComponent(mCancel[1]));
    }
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
