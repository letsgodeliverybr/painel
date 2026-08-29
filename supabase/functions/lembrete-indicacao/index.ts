// Push periódico (a cada 3 dias, mesmo ciclo do lembrete-avaliacao — ver
// migration add_cron_lembrete_indicacao.sql) convidando o entregador a
// indicar um motoboy ou uma loja nova pro programa de indicação. Mesma
// function serve 3 chamadores, sem duplicar lógica — ver comentário
// equivalente em lembrete-avaliacao/index.ts (pg_cron / botão "Enviar
// agora pra todos" / botão "Testar" do painel).
//
// Autenticação: x-webhook-secret (mesmo padrão de delete-entregador/
// update-entregador-email) — ver comentário completo em
// lembrete-avaliacao/index.ts sobre a troca do antigo Authorization
// Bearer + cron_dispatch_key pra esse header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FCM_PROJECT_ID = "lets-go-delivery-df74d";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "letsgo2026secret";

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

// Fallback só — o texto de verdade vive na tabela `configuracoes` (chaves
// notif_indicacao_titulo/notif_indicacao_corpo), editável pelo admin no
// painel (Disparo WhatsApp → Disparar Notificações). Valores confirmados
// com o usuário antes de virar padrão: R$2/km (motoboy ou loja indicada),
// R$150 de bônus extra se a indicação for uma loja nova, contato
// (11) 99170-2772.
const TITULO_PADRAO = "🛵 Ei, motoboy!";
const CORPO_PADRAO =
  "Já tá gostando de faturar R$2 por km rodado nas entregas? Indique um " +
  "motoboy ou uma loja nova pra Let's Go Delivery e fature ainda mais — " +
  "R$150 de bônus por loja indicada! Chama (11) 99170-2772, time de " +
  "expansão nacional Let's Go Delivery.";

async function sendFCM(
  token: string,
  accessToken: string,
  titulo: string,
  corpo: string,
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
          data: { tipo: "indicacao", titulo, corpo },
          android: { priority: "normal" },
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
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS_HEADERS });

  const secret = req.headers.get("x-webhook-secret");
  if (secret !== WEBHOOK_SECRET) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Body opcional { entregador_id_teste: "..." } — mesmo mecanismo de
  // lembrete-avaliacao, pra testar mirando 1 entregador só.
  let entregadorIdTeste: string | undefined;
  try {
    const body = await req.json();
    entregadorIdTeste = body?.entregador_id_teste;
  } catch (_) {
    // body vazio/não-JSON (caso do pg_cron) — segue broadcast normal.
  }

  const { data: cfg } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["notif_indicacao_titulo", "notif_indicacao_corpo"]);
  const titulo = cfg?.find((c) => c.chave === "notif_indicacao_titulo")?.valor || TITULO_PADRAO;
  const corpo = cfg?.find((c) => c.chave === "notif_indicacao_corpo")?.valor || CORPO_PADRAO;

  let query = supabase
    .from("entregadores")
    .select("id, fcm_token")
    .eq("aprovado", true)
    .not("fcm_token", "is", null);
  if (entregadorIdTeste) query = query.eq("id", entregadorIdTeste);

  const { data: entregadores, error } = await query;

  if (error) {
    console.error("[lembrete-indicacao] erro ao buscar entregadores:", error.message);
    return json({ error: error.message }, 500);
  }

  if (!entregadores?.length) {
    return json({ sent: 0, total: 0 });
  }

  const accessToken = await getFirebaseAccessToken();
  let sent = 0;
  for (const e of entregadores) {
    if (!e.fcm_token) {
      console.error(`[lembrete-indicacao] entregador ${e.id} sem fcm_token, pulando`);
      continue;
    }
    try {
      const ok = await sendFCM(e.fcm_token, accessToken, titulo, corpo);
      if (ok) sent++;
    } catch (err) {
      console.error(`[lembrete-indicacao] erro no envio pro entregador ${e.id}:`, err);
    }
  }

  return json({ sent, total: entregadores.length });
});
