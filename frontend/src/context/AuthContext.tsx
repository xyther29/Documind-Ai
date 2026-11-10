import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { navigate } from "../lib/router";

export interface SignUpResult {
  error: Error | null;
  user: User | null;
  requiresEmailConfirmation: boolean;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: false,
  isAuthenticated: false,
  isConfigured: isSupabaseConfigured,
  signInWithPassword: async () => ({ error: new Error("Auth not configured") }),
  signUp: async () => ({ error: new Error("Auth not configured"), user: null, requiresEmailConfirmation: false }),
  resetPasswordForEmail: async () => ({ error: new Error("Auth not configured") }),
  updatePassword: async () => ({ error: new Error("Auth not configured") }),
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

    // 3. Listen for authoritative API unauthorized events
    const handleUnauthorized = () => {
      if (isMounted) {
        setSession(null);
        if (typeof window !== "undefined") {
          const currentPath = window.location.pathname;
          // Only redirect if on an authenticated route
          if (currentPath === "/app" || currentPath.startsWith("/app/")) {
            navigate(`/login?expired=true&redirect=${encodeURIComponent(currentPath)}`);
          }
        }
      }
    };

    window.addEventListener("documind:auth-unauthorized", handleUnauthorized);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener("documind:auth-unauthorized", handleUnauthorized);
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

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<{ error: Error | null }> => {
      if (!isSupabaseConfigured || !supabase) {
        return { error: new Error("Authentication service is not configured.") };
      }
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          return { error: new Error(error.message) };
        }
        setSession(data.session);
        return { error: null };
      } catch (err: any) {
        return { error: new Error(err?.message || "Failed to sign in.") };
      }
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      if (!isSupabaseConfigured || !supabase) {
        return {
          error: new Error("Authentication service is not configured."),
          user: null,
          requiresEmailConfirmation: false,
        };
      }
      try {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const emailRedirectTo = `${origin}/auth/callback`;
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo,
          },
        });
        if (error) {
          return { error: new Error(error.message), user: null, requiresEmailConfirmation: false };
        }
        if (data.session) {
          setSession(data.session);
          return { error: null, user: data.user, requiresEmailConfirmation: false };
        }
        // User created but requires email confirmation
        return { error: null, user: data.user, requiresEmailConfirmation: true };
      } catch (err: any) {
        return {
          error: new Error(err?.message || "Failed to create account."),
          user: null,
          requiresEmailConfirmation: false,
        };
      }
    },
    []
  );

  const resetPasswordForEmail = useCallback(
    async (email: string): Promise<{ error: Error | null }> => {
      if (!isSupabaseConfigured || !supabase) {
        return { error: new Error("Authentication service is not configured.") };
      }
      try {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const redirectTo = `${origin}/auth/callback?next=/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo,
        });
        if (error) {
          return { error: new Error(error.message) };
        }
        return { error: null };
      } catch (err: any) {
        return { error: new Error(err?.message || "Failed to send password reset email.") };
      }
    },
    []
  );

  const updatePassword = useCallback(
    async (newPassword: string): Promise<{ error: Error | null }> => {
      if (!isSupabaseConfigured || !supabase) {
        return { error: new Error("Authentication service is not configured.") };
      }
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) {
          return { error: new Error(error.message) };
        }
        return { error: null };
      } catch (err: any) {
        return { error: new Error(err?.message || "Failed to update password.") };
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (_) {}
    }
    setSession(null);
    // Note: Guest session in sessionStorage is intentionally preserved per Phase 3.4
    // requirement to keep guest and authenticated session lifecycles independent.
  }, []);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      isAuthenticated: Boolean(session?.user),
      isConfigured: isSupabaseConfigured,
      signInWithPassword,
      signUp,
      resetPasswordForEmail,
      updatePassword,
      signOut,
      getAccessToken,
    }),
    [
      session,
      loading,
      signInWithPassword,
      signUp,
      resetPasswordForEmail,
      updatePassword,
      signOut,
      getAccessToken,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
