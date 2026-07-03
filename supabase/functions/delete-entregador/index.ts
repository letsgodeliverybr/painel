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
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });

  // Try/catch global: qualquer exceção não prevista aqui dentro precisa passar
  // pelo helper json() pra sair com os headers de CORS, senão vira 500 cru do
  // runtime sem CORS e o navegador reporta como "blocked by CORS policy".
  try {
    const secret = req.headers.get('x-webhook-secret');
    if (secret !== WEBHOOK_SECRET) return json({ error: 'Unauthorized' }, 401);

    let body: { entregador_id: string };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const { entregador_id } = body;
    if (!entregador_id) return json({ error: 'entregador_id obrigatório' }, 400);

    const adminHeaders = {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };

    // Deleta o auth user (o id em entregadores === auth.users.id por convenção do app)
    const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${entregador_id}`, {
      method: 'DELETE',
      headers: adminHeaders,
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
