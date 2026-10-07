import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { supabaseExternal } from "@/integrations/supabase-external/client";

/**
 * Lightweight client-side auth hook.
 * Subscribes to Supabase auth state and exposes the current session/user.
 * Deux sources possibles : Lovable Cloud (email/mot de passe, Google managé)
 * et la base externe (Google OAuth avec identifiants propres, ex. sur Vercel).
 * Use this for UI rendering only — server-side trust checks must go through
 * `requireSupabaseAuth` middleware on serverFn calls.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cloud: Session | null = null;
    let external: Session | null = null;
    const apply = () => {
      setSession(cloud ?? external);
      setLoading(false);
    };

    // Register listeners FIRST to avoid missing events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        cloud = newSession;
        apply();
      },
    );

    let extSub: { unsubscribe: () => void } | undefined;
    try {
      extSub = supabaseExternal.auth.onAuthStateChange((_event, newSession) => {
        external = newSession;
        apply();
      }).data.subscription;
    } catch {
      // Base externe non configurée dans cet environnement — on l'ignore.
    }

    supabase.auth.getSession().then(({ data }) => {
      cloud = data.session;
      apply();
    });

    return () => {
      subscription.unsubscribe();
      extSub?.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null as User | null,
    isAuthenticated: !!session,
    loading,
  };
}
