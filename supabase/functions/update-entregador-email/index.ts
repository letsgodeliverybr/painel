import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? 'letsgo2026secret';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

serve(async (req) => {
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
    const secret = req.headers.get('x-webhook-secret');
    if (secret !== WEBHOOK_SECRET) {
      return json({ error: 'Unauthorized' }, 401);
    }

    let body: { entregador_id: string; email_atual: string; novo_email: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const { entregador_id, email_atual, novo_email } = body;
    if (!entregador_id || !email_atual || !novo_email) {
      return json({ error: 'entregador_id, email_atual e novo_email são obrigatórios' }, 400);
    }

    const adminHeaders = {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };

    // 1. Busca o auth user pelo email atual
    const listRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
      { headers: adminHeaders }
    );
    if (!listRes.ok) {
      const err = await listRes.text();
      return json({ error: 'Falha ao buscar usuários Auth', detail: err }, 500);
    }
    const listData = await listRes.json();
    const authUser = (listData.users ?? []).find(
      (u: { email: string }) => u.email?.toLowerCase() === email_atual.toLowerCase()
    );
    if (!authUser) {
      return json({ error: `Usuário Auth com email "${email_atual}" não encontrado` }, 404);
    }

    // 2. Atualiza o email no Supabase Auth
    const patchRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`,
      { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ email: novo_email }) }
    );
    if (!patchRes.ok) {
      const err = await patchRes.text();
      return json({ error: 'Falha ao atualizar email no Auth', detail: err }, 500);
    }

    // 3. Atualiza o email na tabela entregadores
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/entregadores?id=eq.${entregador_id}`,
      { method: 'PATCH', headers: { ...adminHeaders, 'Prefer': 'return=minimal' }, body: JSON.stringify({ email: novo_email, updated_at: new Date().toISOString() }) }
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
