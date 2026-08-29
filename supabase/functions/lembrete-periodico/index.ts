// Function ÚNICA e genérica pra servir os 10 novos cards de notificação
// periódica (5 dias úteis × 2 horários — ver aba "Disparar Notificações"
// no painel) — em vez de criar 10 Edge Functions quase idênticas, essa
// recebe {chave} no body indicando QUAL card disparar, lê o texto daquele
// card específico em `configuracoes` (chaves notif_<chave>_titulo/corpo,
// uma linha por card, nunca reaproveitadas entre cards) e manda pra todos
// os entregadores aprovados — exatamente o mesmo mecanismo (JWT do
// Firebase + sendFCM) já usado em lembrete-avaliacao/lembrete-indicacao,
// só que parametrizado em vez de duplicado 10x.
//
// Mesmos 3 chamadores de sempre (ver lembrete-avaliacao/index.ts):
//   1. pg_cron (body:{chave:'seg_manha'}, por exemplo) — 1 job por card.
//   2. Painel, botão "Testar comigo" (body:{chave:'...', entregador_id_teste:'...'}).
//   3. Painel, se um dia ganhar "Enviar agora pra todos" (body:{chave:'...'}) —
//      não usado hoje pelos 10 cards novos (só automático), mas a function
//      já suporta sem mudar nada.
//
// Autenticação: x-webhook-secret, mesmo padrão de lembrete-avaliacao/
// lembrete-indicacao (ver comentário completo lá).
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

// Data-only DE PROPÓSITO, mesmo motivo já documentado em
// lembrete-avaliacao/index.ts — tipo:"periodico" é tratado no app
// (showPeriodicoLocal em notification_service.dart) com um canal neutro,
// sem som insistente/alarme (isso é lembrete, não é "pedido chegando" —
// não pode cair no branch de showNovoPedidoLocal por engano).
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
          data: { tipo: "periodico", titulo, corpo },
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

// Só letras/números/underscore — evita injeção de filtro OR-like na query
// de configuracoes (chave vem direto do body da requisição).
const CHAVE_VALIDA = /^[a-z0-9_]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS_HEADERS });

  const secret = req.headers.get("x-webhook-secret");
  if (secret !== WEBHOOK_SECRET) return json({ error: "Unauthorized" }, 401);

  let body: { chave?: string; entregador_id_teste?: string };
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const chave = body?.chave;
  if (!chave || !CHAVE_VALIDA.test(chave)) {
    return json({ error: "chave obrigatória (ex: 'seg_manha')" }, 400);
  }
  const entregadorIdTeste = body?.entregador_id_teste;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: cfg } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", [`notif_${chave}_titulo`, `notif_${chave}_corpo`]);
  const titulo = cfg?.find((c) => c.chave === `notif_${chave}_titulo`)?.valor || "";
  const corpo = cfg?.find((c) => c.chave === `notif_${chave}_corpo`)?.valor || "";

  // Texto ainda não preenchido pelo admin (cards nascem vazios/placeholder,
  // de propósito) — não manda notificação em branco pra ninguém, nem em
  // teste nem no disparo automático real.
  if (!titulo || !corpo) {
    return json({ sent: 0, total: 0, aviso: `texto do card '${chave}' ainda não configurado` });
  }

  let query = supabase
    .from("entregadores")
    .select("id, fcm_token")
    .eq("aprovado", true)
    .not("fcm_token", "is", null);
  if (entregadorIdTeste) query = query.eq("id", entregadorIdTeste);

  const { data: entregadores, error } = await query;

  if (error) {
    console.error(`[lembrete-periodico:${chave}] erro ao buscar entregadores:`, error.message);
    return json({ error: error.message }, 500);
  }

  if (!entregadores?.length) {
    return json({ sent: 0, total: 0 });
  }

  const accessToken = await getFirebaseAccessToken();
  let sent = 0;
  for (const e of entregadores) {
    if (!e.fcm_token) {
      console.error(`[lembrete-periodico:${chave}] entregador ${e.id} sem fcm_token, pulando`);
      continue;
    }
    try {
      const ok = await sendFCM(e.fcm_token, accessToken, titulo, corpo);
      if (ok) sent++;
    } catch (err) {
      console.error(`[lembrete-periodico:${chave}] erro no envio pro entregador ${e.id}:`, err);
    }
  }

  return json({ sent, total: entregadores.length, chave });
});
