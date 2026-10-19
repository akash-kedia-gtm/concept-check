import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    '[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy .env.example → .env.local and fill in real values.'
  );
}

/**
 * Single shared Supabase client for the browser.
 * Uses the publishable (anon) key — safe to expose in frontend bundles.
 * Server-side secrets (service_role) are never imported here.
 */
export const supabase = createClient(supabaseUrl, supabasePublishableKey);
