export type Service = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  duration: number;
  price: number;
  tag?: string;
};

export type Barber = {
  id: string;
  name: string;
  initials: string;
  chair: string;
  specialties: string;
  nextAvailable: string;
};

export const services: Service[] = [
  {
    id: 'cut',
    name: 'Corte',
    shortName: 'Corte',
    description: 'Tesoura ou máquina, com acabamento no detalhe.',
    duration: 45,
    price: 40,
    tag: 'Mais pedido',
  },
  {
    id: 'beard',
    name: 'Barba',
    shortName: 'Barba',
    description: 'Desenho, toalha quente e finalização.',
    duration: 35,
    price: 35,
  },
  {
    id: 'combo',
    name: 'Corte + barba',
    shortName: 'Combo',
    description: 'Visual completo em uma única visita.',
    duration: 75,
    price: 75,
    tag: 'Completo',
  },
  {
    id: 'eyebrow',
    name: 'Sobrancelha',
    shortName: 'Sobrancelha',
    description: 'Alinhamento natural para completar o visual.',
    duration: 15,
    price: 15,
  },
];

export const barbers: Barber[] = [
  {
    id: 'first',
    name: 'Primeiro disponível',
    initials: '01',
    chair: 'MAIS RÁPIDO',
    specialties: 'A agenda escolhe o melhor encaixe',
    nextAvailable: 'Hoje, 14:30',
  },
  {
    id: 'victor',
    name: 'Victor',
    initials: 'V',
    chair: 'CADEIRA 01',
    specialties: 'Fade · barba · acabamento',
    nextAvailable: 'Hoje, 16:00',
  },
  {
    id: 'bruno',
    name: 'Bruno',
    initials: 'B',
    chair: 'CADEIRA 02',
    specialties: 'Tesoura · clássico · infantil',
    nextAvailable: 'Amanhã, 09:30',
  },
];

export const timeSlots = ['09:00', '09:45', '10:30', '11:15', '14:00', '14:45', '16:00', '17:30', '18:15'];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function makeDateOptions(total = 7) {
  return Array.from({ length: total }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const weekday = index === 0
      ? 'Hoje'
      : new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', '');
    const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(date);
    const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
    return { iso: toIsoDate(date), weekday, date: `${day} ${month}` };
  });
}

export function formatBookingDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(date);
}
