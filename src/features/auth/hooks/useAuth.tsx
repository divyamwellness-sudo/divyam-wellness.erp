import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import type { BusinessSettings, Profile } from '@/types';
import {
  fetchBusinessSettings,
  fetchProfile,
  signInWithEmail as signInRequest,
  signOut as signOutRequest,
  type AuthSession,
} from '@/features/auth/services/auth.service';

type AuthContextValue = {
  session: AuthSession | null;
  profile: Profile | null;
  businessSettings: BusinessSettings | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapSession(session: Session | null): AuthSession | null {
  if (!session?.user.email) {
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email,
  };
}

async function loadUserData(userId: string) {
  const [profile, businessSettings] = await Promise.all([
    fetchProfile(userId),
    fetchBusinessSettings(),
  ]);

  return { profile, businessSettings };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrate = useCallback(async (activeSession: Session | null) => {
    const mapped = mapSession(activeSession);
    setSession(mapped);

    if (!mapped) {
      setProfile(null);
      setBusinessSettings(null);
      return;
    }

    const data = await loadUserData(mapped.userId);
    setProfile(data.profile);
    setBusinessSettings(data.businessSettings);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        if (isMounted) {
          await hydrate(data.session);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void hydrate(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [hydrate]);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { session: nextSession } = await signInRequest(email, password);
      await hydrate(nextSession);
    } finally {
      setIsLoading(false);
    }
  }, [hydrate]);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await signOutRequest();
      await hydrate(null);
    } finally {
      setIsLoading(false);
    }
  }, [hydrate]);

  const refreshProfile = useCallback(async () => {
    if (!session) {
      return;
    }

    const data = await loadUserData(session.userId);
    setProfile(data.profile);
    setBusinessSettings(data.businessSettings);
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      businessSettings,
      isLoading,
      isAuthenticated: Boolean(session),
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, profile, businessSettings, isLoading, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
