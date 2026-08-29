// Push periódico (a cada 7 dias, ver migration add_cron_lembrete_indicacao.sql)
// convidando o entregador a indicar um motoboy ou uma loja nova pro
// programa de indicação. Mesmo padrão de tudo: autenticação via gateway
// (cron_dispatch_key do Vault, não verificado aqui dentro — igual
// despacho-engine/ifood-polling), payload data-only (mesmo motivo já
// documentado em lembrete-avaliacao: notification+data não disparava o
// tap de forma confiável, testado em produção), lógica de envio duplicada
// do mesmo padrão de notify-novo-pedido/lembrete-avaliacao (sem módulo
// compartilhado entre Edge Functions neste projeto ainda).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FCM_PROJECT_ID = "lets-go-delivery-df74d";

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

// Só referência/documentação — quem decide o texto real é o app
// (showIndicacaoLocal em notification_service.dart), payload é data-only.
// Texto e valores confirmados com o usuário, não alterar sem confirmar de novo:
// R$2/km (motoboy ou loja indicada), R$150 de bônus extra se a indicação
// for uma loja nova, contato (11) 99170-2772.
const TITULO = "🛵 Ei, motoboy!";
const CORPO =
  "Já tá gostando de faturar R$2 por km rodado nas entregas? Indique um " +
  "motoboy ou uma loja nova pra Let's Go Delivery e fature ainda mais — " +
  "R$150 de bônus por loja indicada! Chama (11) 99170-2772, time de " +
  "expansão nacional Let's Go Delivery.";

async function sendFCM(token: string, accessToken: string): Promise<boolean> {
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
          data: { tipo: "indicacao" },
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

  let query = supabase
    .from("entregadores")
    .select("id, fcm_token")
    .eq("aprovado", true)
    .not("fcm_token", "is", null);
  if (entregadorIdTeste) query = query.eq("id", entregadorIdTeste);

  const { data: entregadores, error } = await query;

  if (error) {
    console.error("[lembrete-indicacao] erro ao buscar entregadores:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!entregadores?.length) {
    return new Response(JSON.stringify({ sent: 0, total: 0 }), { status: 200 });
  }

  const accessToken = await getFirebaseAccessToken();
  let sent = 0;
  for (const e of entregadores) {
    if (!e.fcm_token) {
      console.error(`[lembrete-indicacao] entregador ${e.id} sem fcm_token, pulando`);
      continue;
    }
    try {
      const ok = await sendFCM(e.fcm_token, accessToken);
      if (ok) sent++;
    } catch (err) {
      console.error(`[lembrete-indicacao] erro no envio pro entregador ${e.id}:`, err);
    }
  }

  return new Response(
    JSON.stringify({ sent, total: entregadores.length }),
    { status: 200 },
  );
});
