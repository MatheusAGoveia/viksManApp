import type { Session, User } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type UserRole = 'client' | 'barber' | 'reception' | 'manager' | 'admin';

export type ClientProfile = {
  id: string;
  fullName: string;
  phone: string | null;
  birthDate: string | null;
  role: UserRole;
  marketingConsent: boolean;
  whatsappConsent: boolean;
};

type AuthResult = { error?: string; message?: string };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: ClientProfile | null;
  loading: boolean;
  configured: boolean;
  isStaff: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (fullName: string, email: string, password: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updateProfile: (input: Partial<Omit<ClientProfile, 'id' | 'role'>>) => Promise<AuthResult>;
  deleteAccount: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function emailRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/account`;
  }
  return 'viksman://account';
}

function mapProfile(row: Record<string, unknown>): ClientProfile {
  return {
    id: String(row.id),
    fullName: String(row.full_name ?? ''),
    phone: row.phone ? String(row.phone) : null,
    birthDate: row.birth_date ? String(row.birth_date) : null,
    role: (row.role as UserRole) ?? 'client',
    marketingConsent: Boolean(row.marketing_consent),
    whatsappConsent: Boolean(row.whatsapp_consent),
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const user = session?.user ?? null;

  const loadProfile = useCallback(async (userId?: string) => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data ? mapProfile(data as Record<string, unknown>) : null);
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      return loadProfile(data.session?.user.id);
    }).finally(() => setLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      queueMicrotask(() => loadProfile(nextSession?.user.id));
    });
    return () => subscription.subscription.unsubscribe();
  }, [loadProfile]);

  async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
    if (!supabase) return { error: 'Backend ainda não configurado.' };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: error.message } : {};
  }

  async function signUpWithEmail(fullName: string, email: string, password: string): Promise<AuthResult> {
    if (!supabase) return { error: 'Backend ainda não configurado.' };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: emailRedirectUrl(),
      },
    });
    if (error) return { error: error.message };
    return data.session ? {} : { message: 'Confira seu e-mail para confirmar o cadastro.' };
  }

  async function resetPassword(email: string): Promise<AuthResult> {
    if (!supabase) return { error: 'Backend ainda não configurado.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: emailRedirectUrl(),
    });
    return error ? { error: error.message } : { message: 'Enviamos as instruções para seu e-mail.' };
  }

  async function updateProfile(input: Partial<Omit<ClientProfile, 'id' | 'role'>>): Promise<AuthResult> {
    if (!supabase || !user) return { error: 'Entre na sua conta para editar o perfil.' };
    const payload = {
      full_name: input.fullName,
      phone: input.phone,
      birth_date: input.birthDate,
      marketing_consent: input.marketingConsent,
      whatsapp_consent: input.whatsappConsent,
    };
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
    if (!error) await loadProfile(user.id);
    return error ? { error: error.message } : {};
  }

  async function deleteAccount(): Promise<AuthResult> {
    if (!supabase || !user) return { error: 'Nenhuma conta conectada.' };
    const { error } = await supabase.functions.invoke('delete-account');
    if (!error) await supabase.auth.signOut();
    return error ? { error: error.message } : {};
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setProfile(null);
  }

  const value: AuthContextValue = {
    user,
    session,
    profile,
    loading,
    configured: isSupabaseConfigured,
    isStaff: Boolean(profile && profile.role !== 'client'),
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    updateProfile,
    deleteAccount,
    signOut,
    refreshProfile: () => loadProfile(user?.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
