import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { clearGuestSession } from "../lib/guest";

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: false,
  isAuthenticated: false,
  isConfigured: isSupabaseConfigured,
  signOut: async () => {},
  getAccessToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // 1. Initial session restoration
    supabase.auth
      .getSession()
      .then(({ data: { session: restoredSession } }) => {
        if (isMounted) {
          setSession(restoredSession);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSession(null);
          setLoading(false);
        }
      });

    // 2. Auth state subscription
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (isMounted) {
        setSession(currentSession);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }

    // If active session exists, check expiration
    if (session) {
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      // If valid for at least 30 more seconds, return current access token
      if (expiresAt - Date.now() > 30_000) {
        return session.access_token;
      }
    }

    // Refresh session if missing or close to expiry
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        return null;
      }
      setSession(data.session);
      return data.session.access_token;
    } catch (_) {
      return null;
    }
  }, [session]);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (_) {}
    }
    setSession(null);
    clearGuestSession();
  }, []);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      isAuthenticated: Boolean(session?.user),
      isConfigured: isSupabaseConfigured,
      signOut,
      getAccessToken,
    }),
    [session, loading, signOut, getAccessToken]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
