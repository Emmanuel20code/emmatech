import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSanitizedSupabaseConfig() {
  const envObj = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  const rawUrl = envObj.VITE_SUPABASE_URL || envObj.SUPABASE_URL || '';
  const rawKey = envObj.VITE_SUPABASE_ANON_KEY || envObj.SUPABASE_ANON_KEY || '';

  let sanitizedUrl = 'https://placeholder.supabase.co';

  if (rawUrl && typeof rawUrl === 'string') {
    const trimmed = rawUrl.trim();
    if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
      try {
        const urlCandidate = trimmed.startsWith('http://') || trimmed.startsWith('https://')
          ? trimmed
          : `https://${trimmed}`;
        const parsed = new URL(urlCandidate);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          sanitizedUrl = urlCandidate;
        }
      } catch {
        sanitizedUrl = 'https://placeholder.supabase.co';
      }
    }
  }

  const sanitizedKey = (rawKey && typeof rawKey === 'string' && rawKey.trim() !== '')
    ? rawKey.trim()
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

  return { url: sanitizedUrl, key: sanitizedKey };
}

const { url, key } = getSanitizedSupabaseConfig();

function createSafeFrontendClient(targetUrl: string, targetKey: string): SupabaseClient {
  try {
    return createClient(targetUrl, targetKey);
  } catch (err) {
    console.warn('[Supabase Frontend] Falling back to safe placeholder client:', (err as Error).message);
    return createClient('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder');
  }
}

export const supabase: SupabaseClient = createSafeFrontendClient(url, key);
