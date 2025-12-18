
import { createClient } from '@supabase/supabase-js';

// Safely access environment variables to prevent crashes if import.meta.env is undefined
const env = (import.meta as any).env || {};

// To go live, you must set these environment variables in your deployment platform (Vercel, Netlify, etc.)
// or create a .env file in your project root.
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://zavdreffvcpamfflxrbh.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KQvk-8Juo49aWubGXnIizA_cSCjuGS8';

// Check if credentials are still placeholders
if (!env.VITE_SUPABASE_URL) {
  console.warn(
    "WARNING: Supabase credentials are missing or using placeholders.\n" +
    "To go live, configure the following environment variables:\n" +
    "VITE_SUPABASE_URL\n" +
    "VITE_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
