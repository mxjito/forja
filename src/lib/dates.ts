const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD en hora local. */
export const dayKey = (t: number | Date) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const parseDay = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const startOfDay = (t: number | Date) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Lunes 00:00 de la semana de t. */
export const startOfWeek = (t: number | Date) => {
  const d = new Date(startOfDay(t));
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
};

export const addDays = (t: number, n: number) => {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
};

export const daysBetween = (a: number, b: number) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
/** Orden de la semana empezando en lunes (índices de getDay). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const fmtDate = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtLong = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const fmtTime = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

const clean = (s: string) => s.replace(/\./g, '');
export const formatDate = (t: number) => clean(fmtDate.format(t));
export const formatLong = (t: number) => fmtLong.format(t);
export const formatShort = (t: number) => clean(fmtShort.format(t));
export const formatTime = (t: number) => fmtTime.format(t);

export function relativeDay(t: number, now = Date.now()) {
  const d = daysBetween(t, now);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  if (d > 1 && d < 7) return `Hace ${d} días`;
  return formatDate(t);
}

/** mm:ss o h:mm:ss */
export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatMinutes(ms: number) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${pad(m % 60)}`;
}
