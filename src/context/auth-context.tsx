import type { Session, User } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type UserRole = 'client' | 'barber' | 'reception' | 'manager' | 'admin';
export type ViksClubStatus = 'inactive' | 'active' | 'paused' | 'canceled';

export type ClientProfile = {
  id: string;
  fullName: string;
  phone: string | null;
  birthDate: string | null;
  role: UserRole;
  marketingConsent: boolean;
  whatsappConsent: boolean;
  preferredBarberId: string | null;
  prefersSilentService: boolean;
  viksClubStatus: ViksClubStatus;
  viksPointsBalance: number;
};

type AuthResult = { error?: string; message?: string };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: ClientProfile | null;
  loading: boolean;
  configured: boolean;
  isStaff: boolean;
  isManager: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (fullName: string, email: string, password: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updateProfile: (input: Partial<Omit<ClientProfile, 'id' | 'role' | 'viksClubStatus' | 'viksPointsBalance'>>) => Promise<AuthResult>;
  deleteAccount: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function emailRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/profile`;
  }
  return 'viksman://profile';
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
    preferredBarberId: row.preferred_barber_id ? String(row.preferred_barber_id) : null,
    prefersSilentService: Boolean(row.prefers_silent_service),
    viksClubStatus: (row.viks_club_status as ViksClubStatus) ?? 'inactive',
    viksPointsBalance: Number(row.viks_points_balance ?? 0),
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
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: error.message };
    setSession(data.session);
    await loadProfile(data.session?.user.id);
    return {};
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

  async function updateProfile(
    input: Partial<Omit<ClientProfile, 'id' | 'role' | 'viksClubStatus' | 'viksPointsBalance'>>,
  ): Promise<AuthResult> {
    if (!supabase || !user) {
      // Demo mode / offline support: update local state directly
      if (profile) {
        setProfile({
          ...profile,
          ...(input.fullName !== undefined && { fullName: input.fullName }),
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(input.birthDate !== undefined && { birthDate: input.birthDate }),
          ...(input.marketingConsent !== undefined && { marketingConsent: input.marketingConsent }),
          ...(input.whatsappConsent !== undefined && { whatsappConsent: input.whatsappConsent }),
          ...(input.preferredBarberId !== undefined && { preferredBarberId: input.preferredBarberId }),
          ...(input.prefersSilentService !== undefined && { prefersSilentService: input.prefersSilentService }),
        });
        return {};
      }
      return { error: 'Entre na sua conta para editar o perfil.' };
    }

    const payload: Record<string, unknown> = {};
    if (input.fullName !== undefined) payload.full_name = input.fullName;
    if (input.phone !== undefined) payload.phone = input.phone;
    if (input.birthDate !== undefined) payload.birth_date = input.birthDate;
    if (input.marketingConsent !== undefined) payload.marketing_consent = input.marketingConsent;
    if (input.whatsappConsent !== undefined) payload.whatsapp_consent = input.whatsappConsent;
    if (input.preferredBarberId !== undefined) payload.preferred_barber_id = input.preferredBarberId;
    if (input.prefersSilentService !== undefined) payload.prefers_silent_service = input.prefersSilentService;

    let { error } = await supabase.from('profiles').update(payload as any).eq('id', user.id);
    if (error && (error.message.includes('prefers_silent_service') || error.message.includes('preferred_barber_id') || error.message.includes('schema cache'))) {
      delete payload.prefers_silent_service;
      delete payload.preferred_barber_id;
      if (Object.keys(payload).length > 0) {
        const retry = await supabase.from('profiles').update(payload as any).eq('id', user.id);
        error = retry.error;
      } else {
        error = null;
      }
    }
    if (!error) {
      await loadProfile(user.id);
      setProfile((current) =>
        current
          ? {
              ...current,
              ...(input.fullName !== undefined && { fullName: input.fullName }),
              ...(input.phone !== undefined && { phone: input.phone }),
              ...(input.birthDate !== undefined && { birthDate: input.birthDate }),
              ...(input.marketingConsent !== undefined && { marketingConsent: input.marketingConsent }),
              ...(input.whatsappConsent !== undefined && { whatsappConsent: input.whatsappConsent }),
              ...(input.preferredBarberId !== undefined && { preferredBarberId: input.preferredBarberId }),
              ...(input.prefersSilentService !== undefined && { prefersSilentService: input.prefersSilentService }),
            }
          : null,
      );
    }
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
    isManager: Boolean(profile && ['manager', 'admin'].includes(profile.role)),
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
