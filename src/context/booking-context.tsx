import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import { barbers, makeDateOptions, services } from '@/data/catalog';
import { brasiliaDateTimeToIso } from '@/lib/brasilia-time';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type Booking = {
  id: string;
  serviceId: string;
  barberId: string;
  date: string;
  time: string;
  status: 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  partySize?: number;
  unitPriceCents?: number;
  gratuityCents?: number;
  paymentStatus?: 'pending' | 'partial' | 'paid' | 'refunded';
  pixKey?: string | null;
  clubBenefitId?: string;
};

type BookingContextValue = {
  bookings: Booking[];
  history: Booking[];
  loading: boolean;
  addBooking: (booking: Omit<Booking, 'id' | 'status'>) => Promise<Booking>;
  cancelBooking: (id: string) => Promise<void>;
  clearBookings: () => void;
  refreshBookings: () => Promise<void>;
};

const STORAGE_KEY = '@viks-man/bookings-v1';
const demoBooking: Booking = {
  id: 'demo-next-appointment',
  serviceId: services[2].id,
  barberId: barbers[1].id,
  date: makeDateOptions(4)[3].iso,
  time: '16:00',
  status: 'confirmed',
  partySize: 1,
  unitPriceCents: services[2].price * 100,
  gratuityCents: 0,
  paymentStatus: 'pending',
  pixKey: 'matheusaagd2@gmail.com',
};
const demoHistory: Booking[] = [
  { id: 'history-1', date: '2026-07-28', time: '16:00', serviceId: 'combo', barberId: 'victor', status: 'completed', partySize: 1, paymentStatus: 'paid' },
  { id: 'history-2', date: '2026-07-05', time: '10:30', serviceId: 'cut', barberId: 'bruno', status: 'completed', partySize: 1, paymentStatus: 'paid' },
];

const BookingContext = createContext<BookingContextValue | null>(null);

function joinedSlug(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value)) return joinedSlug(value[0]);
  return String((value as Record<string, unknown>).slug ?? '');
}

function mapRemoteBooking(row: Record<string, unknown>): Booking {
  const startsAt = new Date(String(row.starts_at));
  const localParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(startsAt);
  const part = (type: Intl.DateTimeFormatPartTypes) => localParts.find((item) => item.type === type)?.value ?? '';
  return {
    id: String(row.id),
    serviceId: joinedSlug(row.service),
    barberId: joinedSlug(row.barber),
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
    status: ['completed', 'cancelled', 'no_show'].includes(String(row.status)) ? String(row.status) as Booking['status'] : 'confirmed',
    partySize: Number(row.party_size ?? 1),
    unitPriceCents: Number(row.unit_price_cents ?? 0),
    gratuityCents: Number(row.gratuity_cents ?? 0),
    paymentStatus: String(row.payment_status ?? 'pending') as Booking['paymentStatus'],
    pixKey: joinedValue(row.unit, 'pix_key'),
  };
}

function joinedValue(value: unknown, key: string) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) return joinedValue(value[0], key);
  const result = (value as Record<string, unknown>)[key];
  return result == null ? null : String(result);
}

export function BookingProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>(isSupabaseConfigured ? [] : [demoBooking]);
  const [history, setHistory] = useState<Booking[]>(isSupabaseConfigured ? [] : demoHistory);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const hydrated = useRef(false);

  const refreshBookings = useCallback(async () => {
    if (!supabase || !user) {
      if (isSupabaseConfigured) { setBookings([]); setHistory([]); }
      setLoading(false);
      return;
    }
    setLoading(true);
    const selection = 'id, starts_at, status, party_size, unit_price_cents, gratuity_cents, payment_status, service:services(slug), barber:barbers(slug), unit:units(pix_key)';
    const [upcomingResult, historyResult] = await Promise.all([
      supabase.from('appointments').select(selection).eq('client_id', user.id).in('status', ['pending', 'confirmed', 'checked_in', 'in_service']).gte('starts_at', new Date().toISOString()).order('starts_at'),
      supabase.from('appointments').select(selection).eq('client_id', user.id).in('status', ['completed', 'cancelled', 'no_show']).order('starts_at', { ascending: false }).limit(20),
    ]);
    if (!upcomingResult.error) setBookings((upcomingResult.data ?? []).map((row) => mapRemoteBooking(row as Record<string, unknown>)));
    if (!historyResult.error) setHistory((historyResult.data ?? []).map((row) => mapRemoteBooking(row as Record<string, unknown>)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (isSupabaseConfigured) {
      queueMicrotask(refreshBookings);
      if (!supabase || !user) return;
      const client = supabase;
      const channel = client
        .channel(`client-appointments-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `client_id=eq.${user.id}` }, () => refreshBookings())
        .subscribe();
      return () => { client.removeChannel(channel); };
    }

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setBookings(JSON.parse(stored) as Booking[]);
      })
      .catch(() => undefined)
      .finally(() => {
        hydrated.current = true;
        setLoading(false);
      });
  }, [refreshBookings, user]);

  useEffect(() => {
    if (isSupabaseConfigured || !hydrated.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bookings)).catch(() => undefined);
  }, [bookings]);

  async function addBooking(input: Omit<Booking, 'id' | 'status'>) {
    if (supabase) {
      if (!user) throw new Error('AUTH_REQUIRED');
      const startsAt = brasiliaDateTimeToIso(input.date, input.time);
      if (input.clubBenefitId) {
        const { data, error } = await supabase.rpc('create_viks_club_appointment', {
          p_subscription_benefit_id: input.clubBenefitId,
          p_unit_slug: 'betim',
          p_service_slug: input.serviceId,
          p_barber_slug: input.barberId,
          p_starts_at: startsAt,
          p_notes: null,
        });
        if (error) throw new Error(error.message);
        const result = data as Record<string, unknown> | null;
        await refreshBookings();
        return {
          ...input,
          id: result?.appointment_id ? String(result.appointment_id) : `remote-${Date.now()}`,
          status: 'confirmed' as const,
        };
      }
      const { data, error } = await supabase.rpc('create_appointment', {
        p_unit_slug: 'betim',
        p_service_slug: input.serviceId,
        p_barber_slug: input.barberId,
        p_starts_at: startsAt,
        p_booked_via: 'app',
        p_party_size: input.partySize ?? 1,
        p_gratuity_cents: input.gratuityCents ?? 0,
      });
      if (error) throw new Error(error.message);
      await refreshBookings();
      return data ? mapRemoteBooking({ ...(data as Record<string, unknown>), service: { slug: input.serviceId }, barber: { slug: input.barberId }, unit: { pix_key: 'matheusaagd2@gmail.com' } }) : { ...input, id: `remote-${Date.now()}`, status: 'confirmed' as const };
    }
    const booking: Booking = { ...input, id: `viks-${Date.now()}`, status: 'confirmed' };
    setBookings((current) => [...current, booking]);
    return booking;
  }

  async function cancelBooking(id: string) {
    if (supabase) {
      const { error } = await supabase.rpc('cancel_appointment', { p_appointment_id: id, p_reason: 'Cancelado pelo cliente' });
      if (error) throw new Error(error.message);
      await refreshBookings();
      return;
    }
    setBookings((current) => current.filter((booking) => booking.id !== id));
  }

  function clearBookings() {
    if (!isSupabaseConfigured) setBookings([]);
  }

  return (
    <BookingContext.Provider value={{ bookings, history, loading, addBooking, cancelBooking, clearBookings, refreshBookings }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBookings() {
  const context = useContext(BookingContext);
  if (!context) throw new Error('useBookings must be used inside BookingProvider');
  return context;
}
