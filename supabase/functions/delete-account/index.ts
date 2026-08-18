import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';

function getSecretKey() {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) return JSON.parse(keys).default as string;
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = getSecretKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'SERVER_NOT_CONFIGURED' }, { status: 500, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const token = authorization.slice('Bearer '.length);
  const { data, error: authError } = await admin.auth.getUser(token);
  if (authError || !data.user) {
    return Response.json({ error: 'INVALID_SESSION' }, { status: 401, headers: corsHeaders });
  }

  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  return Response.json({ deleted: true }, { headers: corsHeaders });
});
