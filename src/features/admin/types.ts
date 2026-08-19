export type AdminTab = 'agenda' | 'clients' | 'catalog' | 'marketing' | 'settings';
export type CalendarMode = 'day' | 'week';

export type Option = {
  id: string;
  slug: string;
  name: string;
  duration?: number;
  price?: number;
  active?: boolean;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  email?: string;
};

export type AdminAppointment = {
  id: string;
  startsAt: string;
  status: string;
  clientId: string;
  clientName: string;
  serviceId: string;
  serviceName: string;
  barberId: string;
  barberName: string;
  duration: number;
  partySize: number;
  totalCents: number;
  paymentStatus: string;
  prefersSilentService: boolean;
};

export type Block = {
  id: string;
  startsAt: string;
  endsAt: string;
  barberName: string;
  kind: string;
  reason: string;
};

export type Promotion = {
  id: string;
  title: string;
  message: string;
  audience: string;
  sendAt: string;
  startsAt: string;
  endsAt: string;
  status: string;
  discountLabel: string;
};
