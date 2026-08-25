import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createServerSupabaseClient(url: string, secretKey: string): SupabaseClient {
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'X-Client-Info': 'truckplan-whatsapp-bot/1.0.0'
      }
    }
  });
}
