import { brasiliaTodayIso } from '@/lib/brasilia-time';
import type { AdminAppointment, Client } from './types';

const todayIso = brasiliaTodayIso;

export const demoClients: Client[] = [
  { id: 'demo-1', name: 'Matheus Damião', phone: '(31) 99999-2104', email: 'matheus@demo.com' },
  { id: 'demo-2', name: 'Rafael Martins', phone: '(31) 98881-7432', email: 'rafael@demo.com' },
  { id: 'demo-3', name: 'Caio Andrade', phone: '(31) 97772-1055', email: 'caio@demo.com' },
];

export function demoAppointments(): AdminAppointment[] {
  return [
    { id: 'apt-1', startsAt: `${todayIso()}T09:00:00-03:00`, status: 'confirmed', clientId: 'demo-2', clientName: 'Rafael Martins', serviceId: 'cut', serviceName: 'Corte', barberId: 'victor', barberName: 'Victor', duration: 45, partySize: 1, totalCents: 4000, paymentStatus: 'pending', prefersSilentService: false },
    { id: 'apt-2', startsAt: `${todayIso()}T10:00:00-03:00`, status: 'checked_in', clientId: 'demo-3', clientName: 'Caio Andrade', serviceId: 'combo', serviceName: 'Corte + barba', barberId: 'bruno', barberName: 'Bruno', duration: 75, partySize: 2, totalCents: 15000, paymentStatus: 'partial', prefersSilentService: true },
    { id: 'apt-3', startsAt: `${todayIso()}T14:30:00-03:00`, status: 'confirmed', clientId: 'demo-1', clientName: 'Matheus Damião', serviceId: 'beard', serviceName: 'Barba', barberId: 'victor', barberName: 'Victor', duration: 35, partySize: 1, totalCents: 3500, paymentStatus: 'paid', prefersSilentService: false },
  ];
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}

export function formatDay(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(value)).replace('.', '');
}

export function joined(row: unknown) {
  if (Array.isArray(row)) return row[0] as Record<string, unknown> | undefined;
  return row as Record<string, unknown> | undefined;
}
