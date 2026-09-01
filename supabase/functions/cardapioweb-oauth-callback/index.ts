import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// PLACEHOLDER — Redirect URI cadastrada no formulário de app do Cardápio
// Web (docs.cardapioweb.com/cw-app-store/cadastro-e-publicacao). Só existe
// pra não dar 404/erro de validação quando o cadastro do app testar a URL.
// Ainda NÃO troca o `code` por token (POST /api/partner/oauth/token) nem
// persiste nada de verdade — só loga o que chegou (query params, body,
// headers), pra quando implementarmos o fluxo real sabermos o formato
// exato que o Cardápio Web manda (ex: se state vem preenchido, se manda
// algum header de assinatura, etc.).
serve(async (req) => {
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

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
    queryParams,
    body,
    headers: Object.fromEntries(req.headers.entries()),
  };
  console.log("[cardapioweb-oauth-callback] recebido:", JSON.stringify(recebido));

  const { error } = await supabase.from("logs_acoes").insert({
    acao: "cardapioweb_oauth_callback_placeholder",
    detalhes: recebido,
  });
  if (error) {
    console.error("[cardapioweb-oauth-callback] falha ao gravar log:", error.message);
  }

  return new Response(
    JSON.stringify({ status: "placeholder, aguardando implementação completa" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
