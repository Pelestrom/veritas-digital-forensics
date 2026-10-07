// Client ADMIN de la base Supabase EXTERNE (service_role).
// À NE JAMAIS importer au niveau module d'un fichier client-atteignable.
// Utilisation dans un handler de server function :
//   const { supabaseExternalAdmin } = await import('@/integrations/supabase-external/client.server');
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const url = process.env.EXTERNAL_SUPABASE_URL;
const serviceKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    'Base Supabase externe non configurée côté serveur. Manque EXTERNAL_SUPABASE_URL ou EXTERNAL_SUPABASE_SERVICE_ROLE_KEY.',
  );
}


export const supabaseExternalAdmin = createClient<Database>(url, serviceKey, {
  auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
});
