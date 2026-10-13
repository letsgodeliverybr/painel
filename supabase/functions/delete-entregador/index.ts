const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_HEADERS = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// Webhook fase 1 (2026-10-12): antes bastava o x-webhook-secret, que está no
// app.js público — qualquer um apagava a conta de qualquer usuário do Auth.
// Agora exige a sessão real de um adm (mesmo padrão de admin-reset-senha).
async function sessaoAdm(req: Request): Promise<string | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!u.ok) return null;
  const id = (await u.json())?.id;
  if (!id) return null;
  const p = await fetch(`${SUPABASE_URL}/rest/v1/usuarios_painel?id=eq.${id}&select=perfil,ativo`, { headers: ADMIN_HEADERS });
  if (!p.ok) return null;
  const r = (await p.json())?.[0];
  return r && r.perfil === 'adm' && r.ativo === true ? id : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });

  // Try/catch global: qualquer exceção não prevista aqui dentro precisa passar
  // pelo helper json() pra sair com os headers de CORS, senão vira 500 cru do
  // runtime sem CORS e o navegador reporta como "blocked by CORS policy".
  try {
    if (!(await sessaoAdm(req))) {
      return json({ error: 'Apenas administradores com sessão ativa. Entre novamente.' }, 401);
    }

    let body: { entregador_id: string };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const { entregador_id } = body;
    if (!entregador_id || !UUID_RE.test(entregador_id)) return json({ error: 'entregador_id obrigatório' }, 400);

    // Conta do painel (adm, suporte, loja) nunca é apagada por aqui.
    const up = await fetch(`${SUPABASE_URL}/rest/v1/usuarios_painel?id=eq.${entregador_id}&select=id`, { headers: ADMIN_HEADERS });
    if (!up.ok) return json({ error: 'Falha ao verificar a conta' }, 500);
    if ((await up.json()).length) return json({ error: 'Esta conta é do painel e não pode ser excluída por aqui' }, 403);

    // Deleta o auth user (o id em entregadores === auth.users.id por convenção do app)
    const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${entregador_id}`, {
      method: 'DELETE',
      headers: ADMIN_HEADERS,
    });

    if (!delRes.ok && delRes.status !== 404) {
      const err = await delRes.text();
      return json({ error: 'Falha ao deletar usuário Auth', detail: err }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: 'Erro interno inesperado', detail: String(e) }, 500);
  }
});
