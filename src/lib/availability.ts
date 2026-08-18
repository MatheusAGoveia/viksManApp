import { formatNextSlot } from '@/lib/brasilia-time';
import { supabase } from '@/lib/supabase';

export type NextAvailableSlot = {
  startsAt: string;
  barberSlug: string;
  barberName: string;
  date: string;
  day: string;
  time: string;
  display: string;
};

export async function getNextAvailableSlot(
  serviceSlug: string,
  barberSlug = 'first',
  partySize = 1,
): Promise<NextAvailableSlot | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_next_available_slot', {
    p_unit_slug: 'betim',
    p_service_slug: serviceSlug,
    p_barber_slug: barberSlug,
    p_party_size: partySize,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  const formatted = formatNextSlot(row.starts_at);
  return {
    startsAt: row.starts_at,
    barberSlug: row.barber_slug,
    barberName: row.barber_name,
    ...formatted,
  };
}
