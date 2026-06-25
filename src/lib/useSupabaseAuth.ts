"use client";

/**
 * Client-side Supabase auth hook.
 * Client-side auth hooks — provides useSupabaseUser() and useSupabaseAuthActions().
 */

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabaseClient } from "./supabase";
import type { User, Session } from "@supabase/supabase-js";

const supabase = createBrowserSupabaseClient();

export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoaded(true);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoaded(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    isLoaded,
    isSignedIn: !!user,
    user,
    session,
  };
}

export function useSupabaseAuthActions() {
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      return supabase.auth.signInWithPassword({ email, password });
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      return supabase.auth.signUp({ email, password });
    },
    [],
  );

  return { signOut, signInWithEmail, signUpWithEmail, supabase };
}
