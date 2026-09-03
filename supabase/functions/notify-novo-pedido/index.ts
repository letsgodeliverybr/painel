import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FCM_PROJECT_ID = "lets-go-delivery-df74d";

// Gera access token OAuth2 a partir da service account do Firebase
async function getFirebaseAccessToken(): Promise<string> {
  const sa = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

  const unsigned = `${b64url(header)}.${b64url(claim)}`;

  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----\n?/, "")
    .replace(/\n?-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );

  const jwt = `${unsigned}.${
    btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")
  }`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const { access_token } = await res.json();
  if (!access_token) throw new Error("Falha ao obter access token do Firebase");
  return access_token;
}

// Data-only, igual despacho-engine/notify-pedido-realocado — achado em
// auditoria (2026-09-03, NOTIFICACOES_MAPA.md e sessões seguintes): o
// bloco `notification` que essa função mandava antes fazia o Android
// exibir a notificação direto pelo sistema em background, SEM passar pelo
// código do app — sem fullScreenIntent, sem o som customizado do canal
// (moeda_caindo_5x), e ainda referenciava um channel_id desatualizado
// (letsgo_novo_pedido_v3, o app hoje usa _v7). data-only força a entrega
// sempre passar pelo _firebaseBackgroundHandler (main.dart, mesmo com o
// app morto), que constrói a notificação local de verdade com
// fullScreenIntent + canal certo — mesmo caminho 100% confiável que já
// funciona pro despacho-engine. Cobre os 3 chamadores atuais desta função
// (app.js: alterarStatusPedidoRelatorio, marcarPedidoPronto — pedido
// voltando pra 'pronto' manualmente, sem entregador_id = broadcast pra
// todo mundo disponível).
async function sendFCM(
  token: string,
  tipo: string,
  accessToken: string,
): Promise<boolean> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          data: { tipo },
          android: { priority: "high" },
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`[FCM] erro token ...${token.slice(-6)}: ${err}`);
  }
  return res.ok;
}

Deno.serve(async (req) => {
  // Valida segredo compartilhado (configurado como env var e no trigger SQL)
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== Deno.env.get("NOTIFY_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const tipo: string = payload.tipo ?? "novo_pedido";
  const entregadorId: string | undefined = payload.entregador_id;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Com entregador_id: envio direcionado a um único entregador (ex: item
  // colocado na fila individual dele pelo roterizador automático), sem
  // exigir disponivel=true (a fila já foi montada pra ele especificamente).
  // Sem entregador_id: broadcast pra todos os entregadores online (fluxo
  // original de pedido avulso, primeiro a aceitar leva).
  const query = supabase
    .from("entregadores")
    .select("id, fcm_token")
    .not("fcm_token", "is", null);

  const { data: entregadores, error } = entregadorId
    ? await query.eq("id", entregadorId)
    : await query.eq("disponivel", true);

  if (error) {
    console.error("[FCM] erro ao buscar entregadores:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  if (!entregadores?.length) {
    console.log("[FCM] nenhum entregador encontrado com token");
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  let accessToken: string;
  try {
    accessToken = await getFirebaseAccessToken();
  } catch (e) {
    console.error("[FCM] falha ao obter token Firebase:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }

  let sent = 0;
  for (const e of entregadores) {
    if (e.fcm_token) {
      const ok = await sendFCM(e.fcm_token, tipo, accessToken);
      if (ok) sent++;
    }
  }

  console.log(
    `[FCM] tipo=${tipo} enviado=${sent} total=${entregadores.length}`,
  );
  return new Response(
    JSON.stringify({ sent, total: entregadores.length }),
    { status: 200 },
  );
});
