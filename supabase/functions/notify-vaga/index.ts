// notify-vaga — avisa o entregador quando a vaga de Entrega Dedicada dele é
// CANCELADA ou quando ele é DESATRIBUÍDO dela (painel: Entrega Dedicada →
// card da vaga). 2026-09-29.
//
// acao 'nova' (Tarefa D): vaga recém-criada → "Nova vaga disponível" pros
// elegíveis (SQL entregadores_para_vaga: online, moto, no raio, respeita clã,
// não bloqueado na loja, sem vaga no mesmo horário). Chamada pelo gatilho
// tg_aviso_vaga_nova (migrations/aviso_vaga_nova.sql). tipo 'nova_vaga' = mesmo
// canal/som/vibração do pedido novo no app. Só envia se
// configuracoes.vaga_nova_push_ativo = 'true' (app antigo não conhece o tipo)
// e uma vez só por vaga (aviso_nova_enviado_em marcado antes de enviar).
//
// Chamada pelo app.js com o mesmo padrão de auth das outras functions de
// ação do painel (x-webhook-secret, verify_jwt=false). Como esse segredo é
// visível no app.js, a function NÃO aceita texto livre: o título/corpo são
// montados aqui a partir da própria vaga, e só envia se a vaga estiver no
// estado que corresponde à ação e tiver mudado há pouco (2 min) — evita usar
// a function pra mandar push arbitrário.
//
// tipo 'periodico' de propósito: é o aviso genérico (título/corpo, sem
// alarme) que o app do entregador já trata hoje. Tipo desconhecido cai no
// fallback de "novo pedido" do app (alarme com volume forçado) — ver
// lets_go_entregador lib/main.dart _firebaseBackgroundHandler.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "letsgo2026secret";
const FCM_SA = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "{}");
const FCM_PROJECT = FCM_SA.project_id ?? "";
const JANELA_MS = 2 * 60 * 1000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

async function getFcmAccessToken(): Promise<string> {
  const payload = {
    iss: FCM_SA.client_email,
    sub: FCM_SA.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: getNumericDate(0),
    exp: getNumericDate(3600),
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };
  const keyData = String(FCM_SA.private_key).replace(/\\n/g, "\n");
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = keyData.substring(keyData.indexOf(pemHeader) + pemHeader.length, keyData.indexOf(pemFooter)).replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", binaryDer.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const jwt = await create({ alg: "RS256", typ: "JWT" }, payload, cryptoKey);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  return (await tokenRes.json()).access_token;
}

const brl = (n: unknown) => `R$ ${Number(n ?? 0).toFixed(2).replace(".", ",")}`;

async function avisarVagaNova(vagaId: string) {
  const { data: cfg } = await supabase.from("configuracoes").select("valor").eq("chave", "vaga_nova_push_ativo").maybeSingle();
  if (String(cfg?.valor ?? "").toLowerCase() !== "true") {
    return json({ ok: false, motivo: "aviso de vaga nova desligado (configuracoes.vaga_nova_push_ativo)" });
  }
  // Marca ANTES de enviar, de forma atômica: só a primeira chamada pra uma
  // vaga disponível criada há no máximo 2 min passa daqui.
  const desde = new Date(Date.now() - JANELA_MS).toISOString();
  const { data: marcada, error: marcarErr } = await supabase.from("vagas_motoboy_fixo")
    .update({ aviso_nova_enviado_em: new Date().toISOString() })
    .eq("id", vagaId).eq("status", "disponivel").is("entregador_id", null)
    .is("aviso_nova_enviado_em", null).gte("created_at", desde)
    .select("id,data,horario_inicio,horario_fim,valor,loja_id");
  if (marcarErr) return json({ ok: false, motivo: marcarErr.message }, 500);
  const vaga = marcada?.[0];
  if (!vaga) return json({ ok: false, motivo: "vaga já avisada, não disponível ou antiga" }, 409);

  const { data: loja } = await supabase.from("lojas").select("nome").eq("id", vaga.loja_id).single();
  const [, m, d] = String(vaga.data).split("-");
  const periodo = `${String(vaga.horario_inicio).slice(0, 5)}–${String(vaga.horario_fim).slice(0, 5)}`;
  const titulo = "Nova vaga disponível";
  const corpo = `${loja?.nome ?? "Loja"} · ${d}/${m} · ${periodo} · ${brl(vaga.valor)}`;

  const { data: alvos, error: alvosErr } = await supabase.rpc("entregadores_para_vaga", { p_vaga_id: vagaId });
  if (alvosErr) return json({ ok: false, motivo: alvosErr.message }, 500);
  if (!alvos?.length || !FCM_PROJECT) return json({ ok: true, enviados: 0 });

  const accessToken = await getFcmAccessToken();
  let enviados = 0;
  for (const e of alvos as { id: string; fcm_token: string }[]) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT}/messages:send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ message: { token: e.fcm_token, data: { tipo: "nova_vaga", titulo, corpo, vaga_id: vagaId }, android: { priority: "HIGH" } } }),
    });
    if (res.ok) enviados++;
    else console.error(`[notify-vaga] erro FCM (nova, entregador ${e.id}):`, await res.text());
  }
  console.log(`[notify-vaga] vaga nova ${vagaId}: ${enviados}/${alvos.length} avisados`);
  return json({ ok: true, enviados, elegiveis: alvos.length });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) return json({ ok: false, motivo: "não autorizado" }, 401);
  try {
    const { vaga_id, entregador_id, acao } = await req.json();
    if (acao === "nova" && vaga_id) return await avisarVagaNova(String(vaga_id));
    if (!vaga_id || !entregador_id || !["cancelada", "desatribuida"].includes(acao)) {
      return json({ ok: false, motivo: "vaga_id, entregador_id e acao (cancelada|desatribuida) obrigatórios" }, 400);
    }
    const { data: vaga, error } = await supabase
      .from("vagas_motoboy_fixo").select("id,data,horario_inicio,horario_fim,status,entregador_id,updated_at,loja_id")
      .eq("id", vaga_id).single();
    if (error || !vaga) return json({ ok: false, motivo: "vaga não encontrada" }, 404);
    // estado tem que bater com a ação, e a mudança tem que ser recente
    const bate = acao === "cancelada"
      ? vaga.status === "cancelada" && vaga.entregador_id === entregador_id
      : vaga.status === "disponivel" && !vaga.entregador_id;
    const recente = Date.now() - new Date(vaga.updated_at).getTime() <= JANELA_MS;
    if (!bate || !recente) return json({ ok: false, motivo: "vaga não está no estado da ação (ou mudança antiga)" }, 409);

    const { data: loja } = await supabase.from("lojas").select("nome").eq("id", vaga.loja_id).single();
    const [, m, d] = String(vaga.data).split("-");
    const periodo = `${String(vaga.horario_inicio).slice(0, 5)}–${String(vaga.horario_fim).slice(0, 5)}`;
    const titulo = acao === "cancelada" ? "Vaga cancelada" : "Você foi removido de uma vaga";
    const corpo = `${loja?.nome ?? "Loja"} · ${d}/${m} · ${periodo}`;

    const { data: ent } = await supabase.from("entregadores").select("fcm_token").eq("id", entregador_id).single();
    if (!ent?.fcm_token || !FCM_PROJECT) return json({ ok: false, motivo: "sem fcm_token ou FCM_PROJECT" });

    const accessToken = await getFcmAccessToken();
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT}/messages:send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ message: { token: ent.fcm_token, data: { tipo: "periodico", titulo, corpo, vaga_id: String(vaga_id), acao }, android: { priority: "HIGH" } } }),
    });
    if (!res.ok) console.error("[notify-vaga] erro FCM:", await res.text());
    return json({ ok: res.ok });
  } catch (e) {
    console.error("[notify-vaga] erro:", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
