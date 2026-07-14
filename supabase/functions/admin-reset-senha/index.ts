const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// Diferente de update-entregador-email (segredo fixo em texto puro no
// app.js), aqui a ação é redefinir a senha de QUALQUER conta — inclusive
// admin. Autenticação é pelo access_token real de quem está logado (já
// existe em sessionStorage desde o login, mesmo o db()/dbPatch() ainda não
// usando isso pra tudo) + confirmação de que essa pessoa é usuarios_painel
// perfil='adm'. Sem isso, qualquer um com a chave pública (exposta no
// app.js) poderia redefinir a senha de qualquer conta do sistema.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('authorization') || '';
    const callerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!callerToken) {
      return json({ error: 'Sessão ausente' }, 401);
    }

    const adminHeaders = {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };

    // 1. Quem está chamando? Valida o token real da sessão contra o Auth.
    const callerRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${callerToken}` },
    });
    if (!callerRes.ok) {
      return json({ error: 'Sessão inválida ou expirada' }, 401);
    }
    const callerUser = await callerRes.json();

    // 2. Essa pessoa é admin em usuarios_painel? (nunca confia em nada vindo do client)
    const perfilRes = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios_painel?id=eq.${callerUser.id}&select=perfil,ativo`,
      { headers: adminHeaders }
    );
    if (!perfilRes.ok) {
      return json({ error: 'Falha ao verificar permissão' }, 500);
    }
    const perfilData = await perfilRes.json();
    const chamador = Array.isArray(perfilData) ? perfilData[0] : null;
    if (!chamador || chamador.perfil !== 'adm' || chamador.ativo !== true) {
      return json({ error: 'Apenas administradores podem redefinir senha' }, 403);
    }

    // 3. Valida o pedido
    let body: { email?: string; novaSenha?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'JSON inválido' }, 400);
    }
    const email = (body.email || '').trim().toLowerCase();
    const novaSenha = body.novaSenha || '';
    if (!email || novaSenha.length < 6) {
      return json({ error: 'email e novaSenha (mínimo 6 caracteres) são obrigatórios' }, 400);
    }

    // 4. Acha o usuário-alvo no Auth pelo email
    const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: adminHeaders,
    });
    if (!listRes.ok) {
      const err = await listRes.text();
      return json({ error: 'Falha ao buscar usuários Auth', detail: err }, 500);
    }
    const listData = await listRes.json();
    const alvo = (listData.users ?? []).find(
      (u: { email: string }) => u.email?.toLowerCase() === email
    );
    if (!alvo) {
      return json({ error: `Usuário Auth com email "${email}" não encontrado` }, 404);
    }

    // 5. Redefine a senha direto — sem e-mail, sem link, sem host exposto
    const patchRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${alvo.id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ password: novaSenha }),
    });
    if (!patchRes.ok) {
      const err = await patchRes.text();
      return json({ error: 'Falha ao redefinir senha no Auth', detail: err }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: 'Erro interno inesperado', detail: String(e) }, 500);
  }
});
