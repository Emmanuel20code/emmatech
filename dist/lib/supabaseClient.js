"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = exports.supabase = exports.hasBrokenSupabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
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
            }
            catch {
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
exports.hasBrokenSupabase = !isConfigured;
function createSafeClient(targetUrl, key) {
    try {
        return (0, supabase_js_1.createClient)(targetUrl, key, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        });
    }
    catch (err) {
        console.warn('[Supabase] Falling back to safe placeholder client:', err.message);
        return (0, supabase_js_1.createClient)('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder', {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        });
    }
}
exports.supabase = createSafeClient(url, anonKey);
exports.supabaseAdmin = createSafeClient(url, serviceKey);
