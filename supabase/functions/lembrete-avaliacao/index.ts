// Push periódico (a cada 3 dias, via pg_cron — ver migration
// add_cron_lembrete_avaliacao.sql) pedindo pro entregador avaliar o app na
// Play Store. Mesmo padrão de autenticação dos outros crons deste projeto
// (despacho-engine-cron, ifood-polling-cron): Authorization: Bearer com o
// cron_dispatch_key guardado no Vault, chamado direto via net.http_post.
//
// Lógica de envio (JWT do service account do Firebase + sendFCM) segue o
// MESMO padrão já usado em notify-novo-pedido/index.ts — não tem módulo
// compartilhado entre Edge Functions neste projeto hoje (cada function é
// isolada, sem import cross-function), então isso duplica esse trecho
// (é a mesma duplicação que já existe entre despacho-engine e
// notify-novo-pedido). Se um dia vier a fazer sentido, dá pra extrair pra
// supabase/functions/_shared/fcm.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FCM_PROJECT_ID = "lets-go-delivery-df74d";
// applicationId real (android/app/build.gradle) — confirmado, não é o
// namespace (com.letsgodelivery.entregador), que é usado só como bundle
// id no iOS/Firebase.
const ANDROID_PACKAGE_ID = "br.com.letsgodelivery.parceiro";

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
// Só referência/documentação — o texto real que aparece pro entregador
// vive em notification_service.dart (showAvaliarAppLocal), já que o
// payload é data-only e quem decide título/corpo é o app, não o servidor.
// Manter os dois iguais na mão se o texto mudar de novo.
const TITULO = "Gostando do app? 💙🩵";
const CORPO = "Deixa sua avaliação pra gente na Play Store!";

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
          data: { tipo: "avaliar_app" },
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

// Autenticação: NÃO verifica nada internamente, de propósito — mesmo
// padrão de despacho-engine/ifood-polling/ifood-status-sync (todos
// chamados por pg_cron do mesmo jeito, com Authorization: Bearer +
// cron_dispatch_key do Vault). Nenhum deles confere esse header dentro do
// próprio código; a verificação acontece no gateway de Edge Functions do
// Supabase (JWT padrão), não é um secret de app. Diferente de
// notify-novo-pedido, que É chamado direto por um trigger SQL com
// --no-verify-jwt e por isso confere um x-webhook-secret próprio.
Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Body opcional { entregador_id_teste: "..." } — pra testar manualmente
  // mirando 1 entregador só, sem disparar pra todo mundo. pg_cron sempre
  // manda body:'{}' (sem esse campo), então o disparo automático real
  // nunca é afetado por isso.
  let entregadorIdTeste: string | undefined;
  try {
    const body = await req.json();
    entregadorIdTeste = body?.entregador_id_teste;
  } catch (_) {
    // body vazio/não-JSON (caso do pg_cron, body:'{}') — segue broadcast normal.
  }

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
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!entregadores?.length) {
    return new Response(JSON.stringify({ sent: 0, total: 0 }), { status: 200 });
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
      const ok = await sendFCM(e.fcm_token, accessToken);
      if (ok) sent++;
    } catch (err) {
      console.error(`[lembrete-avaliacao] erro no envio pro entregador ${e.id}:`, err);
    }
  }

  return new Response(
    JSON.stringify({ sent, total: entregadores.length, package: ANDROID_PACKAGE_ID }),
    { status: 200 },
  );
});
