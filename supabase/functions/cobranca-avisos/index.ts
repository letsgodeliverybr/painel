import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Automação dos avisos de fatura (2026-09-14) — SÓ os avisos. A trava de
// bloqueio de criar entrega por fatura vencida foi removida antes
// (43ab78f) e o usuário confirmou explicitamente que continua removida
// por decisão consciente (fase inicial da empresa) — essa function nunca
// deve voltar a mexer em criar-entrega, só substitui o clique manual no
// botão de WhatsApp que já existia (ver _getEvolutionConfig/msgFinanceiro
// em app.js — mesma tabela `configuracoes`, mesmo template).
//
// Só cobra tipo_cobranca='faturamento' — lojas 'credito' usam saldo
// pré-pago, modelo completamente diferente, já bloqueiam sozinhas por
// saldo insuficiente (sem relação com essa function).
//
// Vencimento não é uma coluna — é sempre calculado (mesma regra do
// painel, app.js: _faturaVencimentoYMD/_diasAtrasoFatura). Vencimento =
// quarta-feira da semana de geração (created_at), ou da semana seguinte
// se gerada qui/sex/sáb. Brasil não observa horário de verão desde
// 2019 — sem ambiguidade de fuso em aritmética de dia-a-dia.
//
// Idempotência: cada estágio (vencimento/vencido) só dispara pra quem
// ainda não tem o timestamp de aviso daquele estágio preenchido — não é
// "hoje é exatamente o dia X", é "já passou do ponto Y e ainda não avisei"
// — se o cron falhar uma semana, a próxima execução ainda pega quem ficou
// pra trás (self-healing), sem depender do dia exato da semana atual.

function dataYMDBrasilia(iso: string): [number, number, number] {
  const d = new Date(iso);
  const brasilia = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return [brasilia.getUTCFullYear(), brasilia.getUTCMonth() + 1, brasilia.getUTCDate()];
}
function vencimentoYMD(createdAtIso: string): [number, number, number] {
  const [y, m, d] = dataYMDBrasilia(createdAtIso);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Dom..6=Sáb, 3=Qua
  const diasAteQuarta = dow <= 3 ? 3 - dow : 10 - dow;
  const venc = new Date(Date.UTC(y, m - 1, d + diasAteQuarta));
  return [venc.getUTCFullYear(), venc.getUTCMonth() + 1, venc.getUTCDate()];
}
function diasAtraso(vencYMD: [number, number, number]): number {
  const hojeUtc = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const vencMs = Date.UTC(vencYMD[0], vencYMD[1] - 1, vencYMD[2]);
  const hojeMs = Date.UTC(hojeUtc.getUTCFullYear(), hojeUtc.getUTCMonth() + 1 - 1, hojeUtc.getUTCDate());
  return Math.round((hojeMs - vencMs) / 86400000);
}

Deno.serve(async (req) => {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== Deno.env.get("NOTIFY_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const tipo: string = payload.tipo;
  if (tipo !== "vencimento" && tipo !== "vencido") {
    return new Response(
      JSON.stringify({ error: "tipo deve ser 'vencimento' ou 'vencido'" }),
      { status: 400 },
    );
  }
  // forcar_cobranca_id: só pra teste manual controlado — ignora a checagem
  // de data (diasAtraso) pra UMA cobrança real específica, mas ainda passa
  // por status/tipo_cobranca/telefone/idempotência normalmente. Nunca é
  // chamado pelo cron (que sempre manda só {tipo}).
  const forcarCobrancaId: string | undefined = payload.forcar_cobranca_id;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: cfgRows, error: cfgErr } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", [
      "evolution_api_url",
      "evolution_api_instance",
      "evolution_api_token",
      "whatsapp_msg_financeiro",
    ]);
  if (cfgErr) {
    return new Response(JSON.stringify({ error: cfgErr.message }), { status: 500 });
  }
  const cfg = Object.fromEntries((cfgRows ?? []).map((r: any) => [r.chave, r.valor]));
  if (!cfg.evolution_api_url || !cfg.evolution_api_instance || !cfg.evolution_api_token) {
    return new Response(JSON.stringify({ error: "Evolution API não configurada em `configuracoes`" }), { status: 500 });
  }
  const msgTemplate: string = cfg.whatsapp_msg_financeiro ||
    "Olá, {loja}! 👋\n\nSegue a fatura do período de cobrança.\nEm caso de dúvidas entre em contato conosco.\n\nLet's Go Delivery";

  const colunaAviso = tipo === "vencimento" ? "aviso_vencimento_em" : "aviso_vencido_em";

  let query = supabase
    .from("cobrancas_lojas")
    .select(`id, loja_id, valor_total, created_at, ${colunaAviso}, lojas(nome, celular, telefone, tipo_cobranca)`)
    .eq("status", "pendente")
    .is(colunaAviso, null);
  if (forcarCobrancaId) query = query.eq("id", forcarCobrancaId);

  const { data: cobs, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let enviados = 0;
  const detalhes: Record<string, unknown>[] = [];

  for (const c of cobs ?? []) {
    const loja = (c as any).lojas;
    if (!loja) { detalhes.push({ cobranca_id: c.id, erro: "loja não encontrada" }); continue; }
    if (loja.tipo_cobranca !== "faturamento") continue; // 'credito' fora do escopo

    if (!forcarCobrancaId) {
      const venc = vencimentoYMD(c.created_at);
      const atraso = diasAtraso(venc);
      const elegivel = tipo === "vencimento" ? atraso === 0 : atraso >= 1;
      if (!elegivel) continue;
    }

    const telefoneRaw = (loja.celular || loja.telefone || "").replace(/\D/g, "");
    if (!telefoneRaw) { detalhes.push({ loja: loja.nome, erro: "sem telefone/celular cadastrado" }); continue; }
    const numero = telefoneRaw.startsWith("55") ? telefoneRaw : "55" + telefoneRaw;
    const msg = msgTemplate.replace(/\{loja\}/g, loja.nome || "");

    try {
      const r = await fetch(`${cfg.evolution_api_url}/message/sendText/${cfg.evolution_api_instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.evolution_api_token },
        body: JSON.stringify({ number: numero, text: msg }),
      });
      if (r.ok) {
        await supabase.from("cobrancas_lojas").update({ [colunaAviso]: new Date().toISOString() }).eq("id", c.id);
        enviados++;
        detalhes.push({ loja: loja.nome, cobranca_id: c.id, ok: true });
      } else {
        const errBody = await r.text().catch(() => "");
        detalhes.push({ loja: loja.nome, cobranca_id: c.id, erro: `HTTP ${r.status} ${errBody}` });
      }
    } catch (e) {
      detalhes.push({ loja: loja.nome, cobranca_id: c.id, erro: String(e) });
    }
  }

  console.log(`[cobranca-avisos] tipo=${tipo} enviados=${enviados} candidatas=${(cobs ?? []).length}`);
  return new Response(
    JSON.stringify({ tipo, enviados, total_candidatas: (cobs ?? []).length, detalhes }),
    { status: 200 },
  );
});
