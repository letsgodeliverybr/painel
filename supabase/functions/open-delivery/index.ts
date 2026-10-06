// Open Delivery v1.7.1 — Let's Go como operador logístico (Logistics Service).
// ETAPA 2: só autenticação (POST /oauth/token). As rotas de entrega entram
// na etapa 3. Função NOVA e separada das do iFood.
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
    return erro(404, "not_found");
  } catch {
    return erro(503, "service_unavailable");
  }
});
