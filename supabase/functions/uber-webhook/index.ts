import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Recebe os webhooks da Uber Direct (event.delivery_status e
// event.courier_update) pra alimentar a tela de acompanhamento no card do
// pedido (app.js, painel do produto do usuário, 2026-09-18). Diferente das
// outras functions do projeto: quem chama aqui é a Uber, não o painel, então
// não usa x-webhook-secret — usa a verificação de assinatura própria da Uber
// (header x-uber-signature, HMAC-SHA256 do corpo bruto com a Webhook Signing
// Key gerada ao cadastrar esse endpoint no dashboard da Uber). Formato do
// payload confirmado contra a documentação oficial (developer.uber.com/docs/
// deliveries/daas/references/api/webhooks/{delivery-status,courier-update}-webhook)
// em 2026-09-18 — ainda não visto contra um evento real (conta bloqueada por
// tax_form_required até agora), por isso: grava o corpo bruto em
// uber_evento_bruto sempre, mesmo se algum campo não bater, pra permitir
// ajuste posterior sem precisar reproduzir o evento.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Não configurada ainda (só existe depois de cadastrar o webhook no
// dashboard da Uber) — enquanto vazia, aceita sem verificar e loga aviso.
const UBER_WEBHOOK_SIGNING_KEY = Deno.env.get("UBER_WEBHOOK_SIGNING_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function logAcao(acao: string, detalhes: Record<string, unknown>) {
  const { error } = await supabase.from("logs_acoes").insert({ acao, detalhes });
  if (error) console.error(`[uber-webhook] FALHA AO GRAVAR LOG:`, error.message, detalhes);
}

async function verificarAssinatura(rawBody: string, assinaturaRecebida: string | null): Promise<boolean> {
  if (!UBER_WEBHOOK_SIGNING_KEY) return true; // sem chave configurada ainda — aceita, mas fica registrado no log
  if (!assinaturaRecebida) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(UBER_WEBHOOK_SIGNING_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const sigHex = Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigHex === assinaturaRecebida;
}

// vehicle_type/make/model/color -> "Toyota Prius branco (car)" — só monta
// com o que vier preenchido, campos variam por tipo de veículo (moto pode
// não ter make/model).
function montarDescricaoVeiculo(courier: any): string | null {
  if (!courier) return null;
  const partes = [courier.vehicle_make, courier.vehicle_model, courier.vehicle_color].filter(Boolean);
  const base = partes.join(" ");
  if (courier.vehicle_type) return base ? `${base} (${courier.vehicle_type})` : courier.vehicle_type;
  return base || null;
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  const assinatura = req.headers.get("x-uber-signature") ?? req.headers.get("x-postmates-signature");

  const assinaturaOk = await verificarAssinatura(rawBody, assinatura);
  if (!UBER_WEBHOOK_SIGNING_KEY) {
    await logAcao("uber_webhook_sem_signing_key", { aviso: "UBER_WEBHOOK_SIGNING_KEY não configurada — evento aceito sem verificação" });
  }
  if (!assinaturaOk) {
    await logAcao("uber_webhook_assinatura_invalida", { assinaturaRecebida: assinatura });
    return json({ error: "Assinatura inválida" }, 401);
  }

  let evento: any;
  try { evento = JSON.parse(rawBody); } catch {
    await logAcao("uber_webhook_json_invalido", { rawBody: rawBody.slice(0, 2000) });
    return json({ error: "Invalid JSON" }, 400);
  }

  // delivery_id vem no topo em ambos os eventos (confirmado na doc); data.id
  // é o mesmo valor duplicado — usa o do topo como principal, data.id como
  // fallback.
  const deliveryId: string | undefined = evento.delivery_id ?? evento.data?.id;
  const kind: string = evento.kind ?? "";

  await logAcao("uber_webhook_recebido", { kind, deliveryId, evento });

  if (!deliveryId) return json({ ok: true, aviso: "sem delivery_id, ignorado" });

  const { data: pedido, error: pedidoErr } = await supabase
    .from("pedidos").select("id, numero").eq("uber_delivery_id", deliveryId).maybeSingle();
  if (pedidoErr) { await logAcao("uber_webhook_erro_buscar_pedido", { deliveryId, message: pedidoErr.message }); return json({ ok: true }); }
  if (!pedido) { await logAcao("uber_webhook_pedido_nao_encontrado", { deliveryId, kind }); return json({ ok: true }); }

  const update: Record<string, unknown> = {
    uber_atualizado_em: new Date().toISOString(),
    uber_evento_bruto: evento,
  };

  const status = evento.data?.status ?? evento.status;
  if (status) update.uber_delivery_status = status;

  const trackingUrl = evento.data?.tracking_url;
  if (trackingUrl) update.uber_tracking_url = trackingUrl;

  if (kind === "event.courier_update") {
    const courier = evento.data?.courier;
    if (courier?.name) update.uber_courier_nome = courier.name;
    if (courier?.phone_number) update.uber_courier_telefone = courier.phone_number;
    const veiculo = montarDescricaoVeiculo(courier);
    if (veiculo) update.uber_courier_veiculo = veiculo;
    const loc = courier?.location ?? evento.location;
    if (loc?.lat != null) update.uber_courier_lat = loc.lat;
    if (loc?.lng != null) update.uber_courier_lng = loc.lng;
  }

  const { error: updateErr } = await supabase.from("pedidos").update(update).eq("id", pedido.id);
  if (updateErr) await logAcao("uber_webhook_erro_gravar", { pedidoId: pedido.id, deliveryId, message: updateErr.message });

  return json({ ok: true });
});
