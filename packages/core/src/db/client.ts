import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | undefined;
let _admin: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (_client) {
    return _client;
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  }

  _client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _client;
}

// Get client with service role (bypass RLS)
export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) {
    return _admin;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for admin access');
  }

  _admin = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _admin;
}

// For specific operations that need different auth
export function createSupabaseClient(options: { anonKey?: string; serviceKey?: string } = {}): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL is required');

  const key = options.serviceKey ?? options.anonKey ?? process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error('SUPABASE_ANON_KEY is required');

  return createClient(url, key);
}
