import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSanitizedSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL || '';
  const rawAnonKey = process.env.SUPABASE_ANON_KEY || '';
  const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || rawAnonKey || '';

  let sanitizedUrl = 'https://placeholder.supabase.co';
  let isConfigured = false;

  if (rawUrl && typeof rawUrl === 'string') {
    const trimmed = rawUrl.trim();
    // Check if user accidentally pasted a postgres connection string or database host
    if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
      try {
        const urlCandidate = trimmed.startsWith('http://') || trimmed.startsWith('https://')
          ? trimmed
          : `https://${trimmed}`;
        const parsed = new URL(urlCandidate);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          sanitizedUrl = urlCandidate;
          isConfigured = true;
        }
      } catch {
        sanitizedUrl = 'https://placeholder.supabase.co';
      }
    }
  }

  const sanitizedAnonKey = (rawAnonKey && typeof rawAnonKey === 'string' && rawAnonKey.trim() !== '')
    ? rawAnonKey.trim()
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

  const sanitizedServiceKey = (rawServiceKey && typeof rawServiceKey === 'string' && rawServiceKey.trim() !== '')
    ? rawServiceKey.trim()
    : sanitizedAnonKey;

  return {
    url: sanitizedUrl,
    anonKey: sanitizedAnonKey,
    serviceKey: sanitizedServiceKey,
    isConfigured
  };
}

const { url, anonKey, serviceKey, isConfigured } = getSanitizedSupabaseConfig();
export const hasBrokenSupabase = !isConfigured;

function createSafeClient(targetUrl: string, key: string): SupabaseClient {
  try {
    return createClient(targetUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
  } catch (err) {
    console.warn('[Supabase] Falling back to safe placeholder client:', (err as Error).message);
    return createClient('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
  }
}

export const supabase: SupabaseClient = createSafeClient(url, anonKey);
export const supabaseAdmin: SupabaseClient = createSafeClient(url, serviceKey);
