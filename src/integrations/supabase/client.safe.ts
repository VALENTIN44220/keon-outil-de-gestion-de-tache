import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const FALLBACK_BACKEND_URL = 'https://xfcgunaxdlhopqlmqdzw.supabase.co';
const FALLBACK_BACKEND_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmY2d1bmF4ZGxob3BxbG1xZHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNDc4NTksImV4cCI6MjA4MzYyMzg1OX0.zkbvdnGpdkZ-SmA7APdEJ3Lg3VCiQaTsfOT_a2aCtvs';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? FALLBACK_BACKEND_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? FALLBACK_BACKEND_PUBLISHABLE_KEY;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.warn('[Backend] Missing VITE backend env vars at build/runtime, using safe fallback config.');
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
