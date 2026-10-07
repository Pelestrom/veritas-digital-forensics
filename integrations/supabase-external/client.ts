// Client Supabase EXTERNE (browser). Additif — n'affecte pas le client Lovable Cloud.
// Utilisation :
//   import { supabaseExternal } from "@/integrations/supabase-external/client";
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

function create() {
  const url = import.meta.env.VITE_SUPABASE_EXTERNAL_URL;
  const key = import.meta.env.VITE_SUPABASE_EXTERNAL_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Base Supabase externe non configurée. Ajoute VITE_SUPABASE_EXTERNAL_URL et VITE_SUPABASE_EXTERNAL_PUBLISHABLE_KEY.',
    );
  }
  return createClient<Database>(url, key, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'sb-external-auth-token',
    },
  });
}

let _client: ReturnType<typeof create> | undefined;
export const supabaseExternal = new Proxy({} as ReturnType<typeof create>, {
  get(_, prop, receiver) {
    if (!_client) _client = create();
    return Reflect.get(_client, prop, receiver);
  },
});
