// Push periódico (a cada 3 dias, via pg_cron — ver migration
// add_cron_lembrete_avaliacao.sql) pedindo pro entregador avaliar o app na
// Play Store. Mesma function serve 3 chamadores, sem duplicar lógica:
//   1. pg_cron (body:'{}') — broadcast real, automático.
//   2. Painel, botão "Enviar agora pra todos" (body:'{}' também, mesmo
//      broadcast — é a mesma chamada de novo, só disparada na mão).
//   3. Painel, botão "Testar" (body:{entregador_id_teste:'...'}) — manda
//      só pra 1 entregador, pra conferir o texto antes de mandar geral.
//
// Autenticação: x-webhook-secret (mesmo padrão de delete-entregador/
// update-entregador-email) — trocado do antigo Authorization Bearer +
// cron_dispatch_key porque agora o painel (browser) também precisa
// chamar essa function direto, e o jeito mais simples/consistente com o
// resto do projeto de habilitar isso é esse header + verify_jwt=false
// (ver supabase/config.toml), igual as outras 2 functions chamadas pelo
// painel. A migration do cron foi atualizada junto pra mandar esse mesmo
// header em vez do Bearer antigo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FCM_PROJECT_ID = "lets-go-delivery-df74d";
// applicationId real (android/app/build.gradle) — confirmado, não é o
// namespace (com.letsgodelivery.entregador), que é usado só como bundle
// id no iOS/Firebase.
const ANDROID_PACKAGE_ID = "br.com.letsgodelivery.parceiro";
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

// Texto neutro de propósito — NÃO menciona "5 estrelas" nem pede nota
// específica: as políticas da Play Store proíbem incentivar/direcionar
// uma avaliação com nota fixa ("review manipulation"), risco real de
// suspensão do app. Convite genérico pra avaliar é permitido.
//
// Fallback só — o texto de verdade vive na tabela `configuracoes` (chaves
// notif_avaliar_app_titulo/notif_avaliar_app_corpo), editável pelo admin
// no painel (Disparo WhatsApp → Disparar Notificações). Esses literais só
// entram em jogo se essas linhas ainda não existirem na tabela.
const TITULO_PADRAO = "Gostando do app? 💙🩵";
const CORPO_PADRAO = "Deixa sua avaliação pra gente na Play Store!";

// Data-only DE PROPÓSITO (sem bloco `notification`) — mesmo padrão já
// corrigido e comprovado no despacho-engine (ver enviarPushFCM). Testado
// nesta sessão: com bloco `notification`, o Android renderiza a
// notificação direto, e o toque nela NÃO disparava o tap-handling do app
// de forma confiável (onMessageOpenedApp nunca chegou a rodar num teste
// real, confirmado via logcat) — abria só o app, nunca a Play Store. Só
// data-only força a notificação a ser sempre criada pelo próprio app
// (_firebaseBackgroundHandler -> showAvaliarAppLocal, com
// payload:'avaliar_app'), cujo toque é tratado por
// onDidReceiveNotificationResponse (flutter_local_notifications), mais
// confiável que depender do tap-tracking do FCM/Android.
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
          data: { tipo: "avaliar_app", titulo, corpo },
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

  // Body opcional { entregador_id_teste: "..." } — pra testar manualmente
  // mirando 1 entregador só, sem disparar pra todo mundo. pg_cron e o
  // botão "Enviar agora pra todos" do painel sempre mandam body:'{}' (sem
  // esse campo), então o disparo broadcast nunca é afetado por isso.
  let entregadorIdTeste: string | undefined;
  try {
    const body = await req.json();
    entregadorIdTeste = body?.entregador_id_teste;
  } catch (_) {
    // body vazio/não-JSON (caso do pg_cron, body:'{}') — segue broadcast normal.
  }

  // Texto: busca na tabela configuracoes (editável pelo admin), cai pro
  // literal padrão se a linha ainda não existir.
  const { data: cfg } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["notif_avaliar_app_titulo", "notif_avaliar_app_corpo"]);
  const titulo = cfg?.find((c) => c.chave === "notif_avaliar_app_titulo")?.valor || TITULO_PADRAO;
  const corpo = cfg?.find((c) => c.chave === "notif_avaliar_app_corpo")?.valor || CORPO_PADRAO;

  // "Ativos" = conta aprovada, com token FCM salvo — não filtra por
  // disponivel=true (isso é sobre estar online pra receber pedido, não
  // sobre a conta existir/estar em uso; push chega igual com o app
  // fechado, então não faz sentido restringir a quem está "disponível"
  // nesse instante).
  let query = supabase
    .from("entregadores")
    .select("id, fcm_token")
    .eq("aprovado", true)
    .not("fcm_token", "is", null);
  if (entregadorIdTeste) query = query.eq("id", entregadorIdTeste);

  const { data: entregadores, error } = await query;

  if (error) {
    console.error("[lembrete-avaliacao] erro ao buscar entregadores:", error.message);
    return json({ error: error.message }, 500);
  }

  if (!entregadores?.length) {
    return json({ sent: 0, total: 0 });
  }

  const accessToken = await getFirebaseAccessToken();
  let sent = 0;
  for (const e of entregadores) {
    // Sem token válido: pula e loga, não derruba o job inteiro por causa
    // de 1 entregador com token ausente/inválido.
    if (!e.fcm_token) {
      console.error(`[lembrete-avaliacao] entregador ${e.id} sem fcm_token, pulando`);
      continue;
    }
    try {
      const ok = await sendFCM(e.fcm_token, accessToken, titulo, corpo);
      if (ok) sent++;
    } catch (err) {
      console.error(`[lembrete-avaliacao] erro no envio pro entregador ${e.id}:`, err);
    }
  }

  return json({ sent, total: entregadores.length, package: ANDROID_PACKAGE_ID });
});
