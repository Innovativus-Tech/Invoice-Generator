// Date-only helpers. Document dates are stored as Postgres DATE (UTC midnight in
// JS), so all arithmetic is done on 'YYYY-MM-DD' strings in UTC. "Today" is
// taken in the business timezone so overdue counts don't flip at UTC midnight.

const TIME_ZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const DAY_MS = 86_400_000;

export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function toISODate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function parseISODate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `b` to `a` (positive when `a` is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / DAY_MS);
}

export function isISODate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(parseISODate(value).getTime());
}
