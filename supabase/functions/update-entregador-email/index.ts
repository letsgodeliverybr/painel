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
// app.js público — qualquer um trocava o e-mail de login de qualquer conta
// (e depois a senha, pela recuperação). Agora exige a sessão real de um adm
// (mesmo padrão de admin-reset-senha).
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  // Try/catch global: qualquer exceção não prevista aqui dentro (rede, parsing,
  // etc.) precisa passar pelo helper json() pra sair com os headers de CORS.
  // Sem isso, uma exceção não tratada vira um 500 cru do runtime, sem CORS —
  // e o navegador reporta como "blocked by CORS policy" em vez do erro real.
  try {
    if (!(await sessaoAdm(req))) {
      return json({ error: 'Apenas administradores com sessão ativa. Entre novamente.' }, 401);
    }

    let body: { entregador_id: string; email_atual: string; novo_email: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const { entregador_id, email_atual, novo_email } = body;
    if (!entregador_id || !email_atual || !novo_email || !UUID_RE.test(entregador_id)) {
      return json({ error: 'entregador_id, email_atual e novo_email são obrigatórios' }, 400);
    }

    // 1. Só conta de entregador: precisa existir em entregadores e não ser do painel.
    const [entRes, upRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/entregadores?id=eq.${entregador_id}&select=id`, { headers: ADMIN_HEADERS }),
      fetch(`${SUPABASE_URL}/rest/v1/usuarios_painel?id=eq.${entregador_id}&select=id`, { headers: ADMIN_HEADERS }),
    ]);
    if (!entRes.ok || !upRes.ok) return json({ error: 'Falha ao verificar a conta' }, 500);
    if (!(await entRes.json()).length) return json({ error: 'Entregador não encontrado' }, 404);
    if ((await upRes.json()).length) return json({ error: 'Esta conta é do painel e não pode ser alterada por aqui' }, 403);

    // 2. O auth user do entregador tem o mesmo id (convenção do app). Antes a
    // busca era pelo e-mail numa lista de 1.000 usuários (parava de achar
    // quando o Auth passasse disso).
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${entregador_id}`, { headers: ADMIN_HEADERS });
    if (!userRes.ok) {
      return json({ error: `Usuário Auth do entregador não encontrado` }, 404);
    }

    // 3. Atualiza o email no Supabase Auth
    const patchRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${entregador_id}`,
      { method: 'PUT', headers: ADMIN_HEADERS, body: JSON.stringify({ email: novo_email }) }
    );
    if (!patchRes.ok) {
      const err = await patchRes.text();
      return json({ error: 'Falha ao atualizar email no Auth', detail: err }, 500);
    }

    // 4. Atualiza o email na tabela entregadores
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/entregadores?id=eq.${entregador_id}`,
      { method: 'PATCH', headers: { ...ADMIN_HEADERS, 'Prefer': 'return=minimal' }, body: JSON.stringify({ email: novo_email, updated_at: new Date().toISOString() }) }
    );
    if (!dbRes.ok) {
      const err = await dbRes.text();
      return json({ error: 'Email atualizado no Auth mas falhou na tabela entregadores', detail: err }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: 'Erro interno inesperado', detail: String(e) }, 500);
  }
});
