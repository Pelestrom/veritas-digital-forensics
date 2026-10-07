// Sélecteur "base principale" — permet de basculer plus tard sans re-toucher l'app.
// Par défaut : Lovable Cloud. Passer VITE_PRIMARY_DB=external pour basculer.
import { supabase } from '@/integrations/supabase/client';
import { supabaseExternal } from '@/integrations/supabase-external/client';

const primary = import.meta.env.VITE_PRIMARY_DB === 'external' ? 'external' : 'lovable';

export const primaryDb = primary === 'external' ? supabaseExternal : supabase;
export const mirrorDb = primary === 'external' ? supabase : supabaseExternal;
export const primaryDbName = primary;
