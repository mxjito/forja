export type Unit = 'kg' | 'lb';
const LB = 2.20462262;

export const toUnit = (kg: number, unit: Unit) => (unit === 'kg' ? kg : kg * LB);
export const fromUnit = (v: number, unit: Unit) => (unit === 'kg' ? v : v / LB);

/** Redondeo para mostrar (conserva 80,6 kg o 1,25 kg). */
export function roundDisplay(v: number, unit: Unit) {
  const step = unit === 'kg' ? 0.05 : 0.1;
  return Math.round(v / step) * step;
}

const nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

export const fmtNum = (v: number, digits = 2) => (digits === 0 ? nf0 : digits === 1 ? nf1 : nf).format(v);

/** "37,5" sin unidad. */
export const showW = (kg: number | null | undefined, unit: Unit) =>
  kg == null ? '—' : fmtNum(roundDisplay(toUnit(kg, unit), unit));

/** "37,5 kg" */
export const showWU = (kg: number | null | undefined, unit: Unit) => (kg == null ? '—' : `${showW(kg, unit)} ${unit}`);

/** Volumen grande: "12,4 t" o "8.540 kg". */
export function showVolume(kg: number, unit: Unit) {
  const v = toUnit(kg, unit);
  if (unit === 'kg' && v >= 10000) return `${nf1.format(v / 1000)} t`;
  return `${nf0.format(v)} ${unit}`;
}

/** Interpreta lo que escribe el usuario ("37,5" o "37.5"). */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
