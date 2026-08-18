export const BRASILIA_TIME_ZONE = 'America/Sao_Paulo';

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRASILIA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function partsAt(date: Date): DateParts {
  const values = Object.fromEntries(
    partsFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function isoFromParts(parts: Pick<DateParts, 'year' | 'month' | 'day'>) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function brasiliaTodayIso(now = new Date()) {
  return isoFromParts(partsAt(now));
}

export function brasiliaDateIso(value: string | Date) {
  return isoFromParts(partsAt(value instanceof Date ? value : new Date(value)));
}

export function addIsoDays(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days, 12));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
}

export function brasiliaDateTimeToIso(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const desiredWallClock = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = desiredWallClock;

  // Resolve the named timezone instead of assuming a permanent UTC offset.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const represented = partsAt(new Date(candidate));
    const representedWallClock = Date.UTC(
      represented.year,
      represented.month - 1,
      represented.day,
      represented.hour,
      represented.minute,
      represented.second,
    );
    candidate += desiredWallClock - representedWallClock;
  }

  return new Date(candidate).toISOString();
}

export function makeBrasiliaDateOptions(total = 7, now = new Date()) {
  const today = brasiliaTodayIso(now);
  return Array.from({ length: total }, (_, index) => {
    const iso = addIsoDays(today, index);
    const instant = new Date(`${iso}T12:00:00Z`);
    const weekday = index === 0
      ? 'Hoje'
      : index === 1
        ? 'Amanhã'
        : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' }).format(instant).replace('.', '');
    const label = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'UTC',
      day: '2-digit',
      month: 'short',
    }).format(instant).replace('.', '');
    return { iso, weekday, date: label };
  });
}

export function formatNextSlot(startsAt: string | Date, now = new Date()) {
  const instant = startsAt instanceof Date ? startsAt : new Date(startsAt);
  const slotDate = isoFromParts(partsAt(instant));
  const today = brasiliaTodayIso(now);
  const tomorrow = addIsoDays(today, 1);
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRASILIA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
  const day = slotDate === today
    ? 'Hoje'
    : slotDate === tomorrow
      ? 'Amanhã'
      : new Intl.DateTimeFormat('pt-BR', {
          timeZone: BRASILIA_TIME_ZONE,
          weekday: 'short',
          day: '2-digit',
          month: 'short',
        }).format(instant).replace(/\./g, '');
  return { date: slotDate, day, time, display: `${day}, ${time}` };
}
