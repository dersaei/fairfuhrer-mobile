import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { identifyUser, resetUser, getCustomerInfo, hasPro } from '@/lib/revenuecat';

export interface Profile {
  id: string;
  role: 'consumer' | 'partner';
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  premium_until: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isPro: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPro: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isPro: false,
  isLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshPro: async () => {},
});

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as Profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkPro = async () => {
    const info = await getCustomerInfo();
    setIsPro(hasPro(info));
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const [p] = await Promise.all([
          fetchProfile(session.user.id),
          identifyUser(session.user.id),
        ]);
        setProfile(p);
        await checkPro();
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session?.user) {
        const [p] = await Promise.all([
          fetchProfile(session.user.id),
          identifyUser(session.user.id),
        ]);
        setProfile(p);
        await checkPro();
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setIsPro(false);
        await resetUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session?.user) {
      const p = await fetchProfile(session.user.id);
      setProfile(p);
    }
  };

  const refreshPro = async () => {
    await checkPro();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      isPro,
      isLoading,
      signOut,
      refreshProfile,
      refreshPro,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
