import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

// Notifica um único entregador quando um pedido é realocado manualmente
// pra ele (fn_intercept_realocacao_manual, trigger BEFORE UPDATE em
// pedidos). Achado em auditoria (NOTIFICACOES_MAPA.md, 2026-09-03): esse
// caminho não passa pelo despacho-engine (é 100% via trigger SQL direto,
// admin reatribuindo manualmente) — a única fonte de notificação que
// existia (o trigger tg_despacho_fila_notify, disparando pra notify-
// novo-pedido) foi removida junto com a correção da triplicação de push,
// sem perceber que era a fonte exclusiva desse caminho específico.
//
// Data-only de propósito, MESMO motivo do despacho-engine: um payload com
// bloco `notification` é renderizado direto pelo Android em background,
// sem nunca chamar código do app — sem fullScreenIntent, sem o alerta
// sonoro customizado (vibração + moeda 5x), só uma notificação muda de
// sistema. Reaproveita a mesma implementação de FCM V1 do despacho-engine,
// função pequena e isolada de propósito (não um trigger genérico em
// despacho_fila) — chamado só por esse UM trigger, não a cada INSERT
// qualquer, pra não reintroduzir a triplicação corrigida antes.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "letsgo2026secret";

const FCM_SA = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "{}");
const FCM_PROJECT = FCM_SA.project_id ?? "";

async function getFcmAccessToken(): Promise<string> {
  const payload = {
    iss: FCM_SA.client_email,
    sub: FCM_SA.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: getNumericDate(0),
    exp: getNumericDate(3600),
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };
  const privateKey = FCM_SA.private_key;
  const keyData = privateKey.replace(/\\n/g, "\n");
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = keyData.substring(
    keyData.indexOf(pemHeader) + pemHeader.length,
    keyData.indexOf(pemFooter)
  ).replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const jwt = await create({ alg: "RS256", typ: "JWT" }, payload, cryptoKey);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

serve(async (req) => {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ ok: false, motivo: "não autorizado" }), { status: 401 });
  }

  try {
    const { entregador_id, pedido_id, numero } = await req.json();
    if (!entregador_id || !pedido_id) {
      return new Response(JSON.stringify({ ok: false, motivo: "entregador_id/pedido_id obrigatórios" }), { status: 400 });
    }

    const { data: ent, error: entErr } = await supabase
      .from("entregadores").select("fcm_token").eq("id", entregador_id).single();
    if (entErr) console.error("[notify-pedido-realocado] buscar fcm_token:", entErr.message);
    if (!ent?.fcm_token || !FCM_PROJECT) {
      return new Response(JSON.stringify({ ok: false, motivo: "sem fcm_token ou FCM_PROJECT" }), { status: 200 });
    }

    const accessToken = await getFcmAccessToken();
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT}/messages:send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
      body: JSON.stringify({
        message: {
          token: ent.fcm_token,
          data: { tipo: "novo_pedido", pedido_id: String(pedido_id), numero: String(numero ?? "") },
          android: { priority: "HIGH" },
        },
      }),
    });
    if (!res.ok) console.error("[notify-pedido-realocado] erro FCM:", await res.text());

    return new Response(JSON.stringify({ ok: res.ok }), { status: 200 });
  } catch (e) {
    console.error("[notify-pedido-realocado] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
