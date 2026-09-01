import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// PLACEHOLDER — Webhook URL cadastrada no formulário de app do Cardápio
// Web (docs.cardapioweb.com/webhooks/eventos). Recebe ORDER_CREATED e
// ORDER_STATUS_UPDATED. Responde 200 IMEDIATAMENTE (webhooks deles
// re-tentam se não receberem resposta rápida) — ainda não consulta
// detalhes do pedido nem despacha nada, só loga o payload recebido, pra
// quando implementarmos de verdade sabermos o formato exato (o evento vem
// resumido: event_id/event_type/merchant_id/order_id/order_status/
// created_at — precisa de uma chamada separada pra detalhes completos).
serve(async (req) => {
  let body: unknown = null;
  try {
    const texto = await req.text();
    if (texto) {
      try { body = JSON.parse(texto); } catch { body = texto; }
    }
  } catch (_e) {
    body = null;
  }

  const recebido = {
    method: req.method,
    body,
    headers: Object.fromEntries(req.headers.entries()),
  };
  console.log("[cardapioweb-webhook-pedido] recebido:", JSON.stringify(recebido));

  const { error } = await supabase.from("logs_acoes").insert({
    acao: "cardapioweb_webhook_pedido_placeholder",
    detalhes: recebido,
  });
  if (error) {
    console.error("[cardapioweb-webhook-pedido] falha ao gravar log:", error.message);
  }

  return new Response(
    JSON.stringify({ status: "placeholder, aguardando implementação completa" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
