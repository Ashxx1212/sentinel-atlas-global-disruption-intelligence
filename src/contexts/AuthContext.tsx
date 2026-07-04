import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface ProfileRecord {
  id: string;
  display_name: string | null;
  timezone: string | null;
  onboarding_completed: boolean | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: ProfileRecord | null;
  loading: boolean;
  isConfigured: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  authError: string | null;
  authMessage: string | null;
  pendingEmailConfirmation: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  completeOnboarding: (displayName: string, timezone: string) => Promise<void>;
}

interface LoadedProfile {
  profile: ProfileRecord | null;
  needsOnboarding: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const defaultProfile = (userId: string): ProfileRecord => ({
  id: userId,
  display_name: null,
  timezone: null,
  onboarding_completed: false,
});

const fallbackProfile = (currentUser: User): ProfileRecord => ({
  id: currentUser.id,
  display_name: currentUser.user_metadata?.full_name ?? currentUser.email?.split('@')[0] ?? null,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  onboarding_completed: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const loadProfile = useCallback(async (currentUser: User): Promise<LoadedProfile> => {
    if (!supabase || !isSupabaseConfigured) {
      return { profile: null, needsOnboarding: false };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, timezone, onboarding_completed')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        return { profile: defaultProfile(currentUser.id), needsOnboarding: true };
      }

      if (!data) {
        const nextProfile = fallbackProfile(currentUser);
        const { error: insertError } = await supabase.from('profiles').insert(nextProfile);

        if (insertError) {
          return { profile: defaultProfile(currentUser.id), needsOnboarding: true };
        }

        return { profile: nextProfile, needsOnboarding: true };
      }

      const nextProfile: ProfileRecord = {
        id: data.id,
        display_name: data.display_name ?? null,
        timezone: data.timezone ?? null,
        onboarding_completed: Boolean(data.onboarding_completed),
      };

      return {
        profile: nextProfile,
        needsOnboarding: !nextProfile.onboarding_completed,
      };
    } catch {
      return { profile: defaultProfile(currentUser.id), needsOnboarding: true };
    }
  }, []);

  const applyProfileForUser = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setNeedsOnboarding(false);
      return;
    }

    const loadedProfile = await loadProfile(currentUser);
    setProfile(loadedProfile.profile);
    setNeedsOnboarding(loadedProfile.needsOnboarding);
  }, [loadProfile]);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    async function applySession(nextSession: Session | null) {
      if (cancelled) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setPendingEmailConfirmation(false);
      setAuthError(null);
      setAuthMessage(null);

      if (nextSession?.user) {
        const loadedProfile = await loadProfile(nextSession.user);
        if (cancelled) return;
        setProfile(loadedProfile.profile);
        setNeedsOnboarding(loadedProfile.needsOnboarding);
      } else {
        setProfile(null);
        setNeedsOnboarding(false);
      }
    }

    async function initialiseSession() {
      if (!supabase || !isSupabaseConfigured) {
        if (!cancelled) {
          setLoading(false);
          setAuthError('Supabase is not configured in this browser build.');
        }
        return;
      }

      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        await applySession(initialSession);
      } catch {
        if (!cancelled) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setNeedsOnboarding(false);
          setAuthError('Unable to restore your session. Please sign in again.');
          setLoading(false);
        }
        return;
      }

      if (cancelled) return;

      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        void applySession(nextSession);
      });
      subscription = data.subscription;
      setLoading(false);
    }

    void initialiseSession();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase || !isSupabaseConfigured) {
      setAuthError('Supabase is not configured in this browser build.');
      return false;
    }

    setLoading(true);
    setAuthError(null);
    setAuthMessage(null);
    setPendingEmailConfirmation(false);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session || !data.user) {
        setAuthError(error?.message || 'Unable to sign in.');
        setLoading(false);
        return false;
      }

      setSession(data.session);
      setUser(data.user);
      await applyProfileForUser(data.user);
      setLoading(false);
      return true;
    } catch {
      setAuthError('Unable to sign in. Please check your connection and try again.');
      setLoading(false);
      return false;
    }
  }, [applyProfileForUser]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase || !isSupabaseConfigured) {
      setAuthError('Supabase is not configured in this browser build.');
      return;
    }

    setLoading(true);
    setAuthError(null);
    setAuthMessage(null);
    setPendingEmailConfirmation(false);

    const redirectTo = `${window.location.origin}/auth`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setAuthError(error.message || 'Unable to create an account.');
      setLoading(false);
      return;
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      await applyProfileForUser(data.user);
      setLoading(false);
      return;
    }

    setPendingEmailConfirmation(true);
    setAuthMessage('Check your email to confirm your account before accessing Sentinel Atlas.');
    setLoading(false);
  }, [applyProfileForUser]);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase || !isSupabaseConfigured) {
      setAuthError('Supabase is not configured in this browser build.');
      return;
    }

    setLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    const redirectTo = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      setAuthError(error.message || 'Unable to send a password reset message.');
      setLoading(false);
      return;
    }

    setAuthMessage('Password reset instructions were sent to your inbox.');
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) {
      setAuthError('Supabase is not configured in this browser build.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message || 'Unable to sign out.');
      setLoading(false);
      return;
    }

    setSession(null);
    setUser(null);
    setProfile(null);
    setNeedsOnboarding(false);
    setPendingEmailConfirmation(false);
    setAuthMessage(null);
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    await applyProfileForUser(user);
  }, [applyProfileForUser, user]);

  const completeOnboarding = useCallback(async (displayName: string, timezone: string) => {
    if (!supabase || !isSupabaseConfigured || !user) {
      setAuthError('You need to be signed in before finishing onboarding.');
      return;
    }

    setLoading(true);
    setAuthError(null);

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      display_name: displayName.trim() || null,
      timezone: timezone || null,
      onboarding_completed: true,
    });

    if (error) {
      setAuthError(error.message || 'Unable to save your onboarding preferences.');
      setLoading(false);
      return;
    }

    await applyProfileForUser(user);
    setAuthMessage('Welcome aboard. Your onboarding preferences are now saved.');
    setLoading(false);
  }, [applyProfileForUser, user]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    profile,
    loading,
    isConfigured: isSupabaseConfigured,
    isAuthenticated: Boolean(user && session),
    needsOnboarding,
    authError,
    authMessage,
    pendingEmailConfirmation,
    signIn,
    signUp,
    requestPasswordReset,
    signOut,
    refreshProfile,
    completeOnboarding,
  }), [authError, authMessage, completeOnboarding, loading, needsOnboarding, pendingEmailConfirmation, profile, refreshProfile, requestPasswordReset, session, signIn, signOut, signUp, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
