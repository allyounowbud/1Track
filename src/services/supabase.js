import { createClient } from '@supabase/supabase-js';

// These will be environment variables in production
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'your-supabase-url';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key';
const useMockData = import.meta.env.VITE_USE_MOCK_DATA === 'true';

// Only create client if we have real credentials and not using mock data
export const supabase = supabaseUrl && supabaseAnonKey && !useMockData 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

export { useMockData };
