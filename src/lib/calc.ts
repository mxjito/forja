import type { Exercise, Muscle, PRKind, Session, SessionExercise, SetEntry } from '../db/types';
import { startOfWeek } from './dates';

export const isLogged = (s: SetEntry) => s.done && s.weight != null;
export const hasReps = (s: SetEntry): s is SetEntry & { weight: number; reps: number } =>
  s.done && s.weight != null && s.reps != null && s.reps > 0;

/** 1RM estimado (Epley). Solo es fiable hasta ~12 reps; por encima devolvemos null. */
export function e1rm(weight: number, reps: number): number | null {
  if (weight <= 0 || reps <= 0 || reps > 12) return null;
  if (reps === 1) return weight;
  // Redondeado a 0,5 kg: es una estimación, más decimales serían falsa precisión.
  return Math.round(weight * (1 + reps / 30) * 2) / 2;
}

export const setVolume = (s: SetEntry) => (hasReps(s) ? s.weight * s.reps : 0);
export const exVolume = (se: SessionExercise) => se.sets.reduce((a, s) => a + setVolume(s), 0);
export const sessionVolume = (s: Session) => s.exercises.reduce((a, e) => a + exVolume(e), 0);
export const doneSets = (se: SessionExercise) => se.sets.filter((s) => s.done);
export const sessionSetCount = (s: Session) => s.exercises.reduce((a, e) => a + doneSets(e).length, 0);

export const sessionDuration = (s: Session, now = Date.now()) => {
  const end = s.endedAt ?? (s.pausedAt ?? now);
  return Math.max(0, end - s.startedAt - s.pausedMs);
};

/** Sesiones terminadas, de la más reciente a la más antigua. */
export const finished = (sessions: Session[]) =>
  sessions.filter((s) => s.status === 'terminada').sort((a, b) => b.startedAt - a.startedAt);

export interface Perf {
  session: Session;
  entry: SessionExercise;
}

/** Última vez que se hizo un ejercicio (con al menos una serie apuntada). */
export function lastPerformance(exerciseId: string, sessions: Session[], excludeId?: string): Perf | null {
  for (const s of finished(sessions)) {
    if (s.id === excludeId) continue;
    const entry = s.exercises.find((e) => e.exerciseId === exerciseId && e.sets.some(isLogged));
    if (entry) return { session: s, entry };
  }
  return null;
}

export const fmtSets = (sets: SetEntry[], show: (kg: number) => string) =>
  sets
    .filter(isLogged)
    .map((s) => `${show(s.weight!)}×${s.reps ?? '?'}`)
    .join(' · ');

export interface Suggestion {
  kind: 'subir' | 'bajar' | 'mantener';
  weightKg: number;
  reason: string;
}

/**
 * Reglas 2 y 3 del programa:
 *  – Máximo de reps en TODAS las series → subir (2.5 kg o la siguiente mancuerna).
 *  – No llegar al mínimo → bajar.
 * Solo sugiere: nunca cambia la rutina.
 */
export function suggestion(entry: SessionExercise, ex: Exercise): Suggestion | null {
  const { repMin, repMax, sets: targetSets } = entry.target;
  if (ex.freeform || repMax <= 0) return null;
  const work = entry.sets.filter(hasReps);
  if (work.length === 0) return null;
  const top = Math.max(...work.map((s) => s.weight));
  const atTop = work.filter((s) => s.weight === top);
  const unknownReps = entry.sets.some((s) => s.done && s.reps == null);
  if (unknownReps) return null;

  if (atTop.length >= targetSets && atTop.every((s) => s.reps >= repMax)) {
    const next = top + ex.increment;
    return {
      kind: 'subir',
      weightKg: next,
      reason: top === 0 && ex.bodyweight
        ? `Hiciste ${repMax}+ reps en todas las series: añade lastre o un disco.`
        : `Llegaste a ${repMax} reps en todas las series con ${trim(top)} kg.`,
    };
  }
  const below = atTop.filter((s) => s.reps < repMin).length;
  if (below > 0 && below >= Math.ceil(atTop.length / 2) && top > 0) {
    return {
      kind: 'bajar',
      weightKg: Math.max(0, top - ex.increment),
      reason: `No llegaste a ${repMin} reps en ${below} de ${atTop.length} series.`,
    };
  }
  return { kind: 'mantener', weightKg: top, reason: `Sigue con ${trim(top)} kg hasta llegar a ${repMax} reps en todas las series.` };
}

const trim = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export interface Bests {
  maxWeight: number;
  maxE1rm: number;
  maxVolume: number;
  /** Más reps con un peso ≥ al dado: mapa peso → reps. */
  repsAt: Map<number, number>;
  count: number;
}

export function bestsFor(exerciseId: string, sessions: Session[], excludeId?: string): Bests {
  const b: Bests = { maxWeight: 0, maxE1rm: 0, maxVolume: 0, repsAt: new Map(), count: 0 };
  for (const s of sessions) {
    if (s.id === excludeId || s.status !== 'terminada') continue;
    for (const e of s.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      let logged = false;
      for (const st of e.sets) {
        if (!isLogged(st)) continue;
        logged = true;
        b.maxWeight = Math.max(b.maxWeight, st.weight!);
        if (st.reps != null) {
          const r = e1rm(st.weight!, st.reps);
          if (r) b.maxE1rm = Math.max(b.maxE1rm, r);
          b.repsAt.set(st.weight!, Math.max(b.repsAt.get(st.weight!) ?? 0, st.reps));
        }
      }
      if (logged) b.count++;
      b.maxVolume = Math.max(b.maxVolume, exVolume(e));
    }
  }
  return b;
}

/** Récords que bate una serie frente al historial (no cuenta la primera vez que se hace el ejercicio). */
export function prsForSet(set: SetEntry, bests: Bests, others: SetEntry[] = []): PRKind[] {
  if (!hasReps(set) || bests.count === 0 || set.weight <= 0) return [];
  const kinds: PRKind[] = [];
  const prevMaxW = Math.max(bests.maxWeight, ...others.filter(hasReps).map((s) => s.weight));
  if (set.weight > prevMaxW) kinds.push('peso');
  const r = e1rm(set.weight, set.reps);
  const otherE = others.filter(hasReps).map((s) => e1rm(s.weight, s.reps) ?? 0);
  if (r && bests.maxE1rm > 0 && r > Math.max(bests.maxE1rm, ...otherE) + 0.01 && !kinds.includes('peso')) kinds.push('e1rm');
  if (!kinds.length) {
    let best = 0;
    for (const [w, reps] of bests.repsAt) if (w >= set.weight) best = Math.max(best, reps);
    for (const o of others) if (hasReps(o) && o.weight >= set.weight) best = Math.max(best, o.reps);
    if (best > 0 && set.reps > best) kinds.push('reps');
  }
  return kinds;
}

export const PR_LABEL: Record<PRKind, string> = { peso: 'Récord de peso', e1rm: 'Récord de 1RM est.', reps: 'Récord de reps' };

/** Historial por ejercicio para gráficas (orden cronológico). */
export interface ExPoint {
  t: number;
  sessionId: string;
  topWeight: number;
  topReps: number | null;
  e1rm: number | null;
  volume: number;
  sets: number;
  totalReps: number | null;
}

export function exerciseSeries(exerciseId: string, sessions: Session[]): ExPoint[] {
  const out: ExPoint[] = [];
  for (const s of finished(sessions).reverse()) {
    for (const e of s.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      const logged = e.sets.filter(isLogged);
      if (!logged.length) continue;
      const top = logged.reduce((a, b) => (b.weight! > a.weight! || (b.weight === a.weight && (b.reps ?? 0) > (a.reps ?? 0)) ? b : a));
      const es = logged.map((x) => (x.reps != null ? e1rm(x.weight!, x.reps) : null)).filter((x): x is number => x != null);
      const repsKnown = logged.every((x) => x.reps != null);
      out.push({
        t: s.startedAt,
        sessionId: s.id,
        topWeight: top.weight!,
        topReps: top.reps,
        e1rm: es.length ? Math.max(...es) : null,
        volume: exVolume(e),
        sets: logged.length,
        totalReps: repsKnown ? logged.reduce((a, x) => a + (x.reps ?? 0), 0) : null,
      });
    }
  }
  return out;
}

// ── Agregados semanales

export interface WeekAgg {
  week: number;
  sessions: number;
  volume: number;
  sets: number;
}

export function weeklyAgg(sessions: Session[], weeks: number, now = Date.now()): WeekAgg[] {
  const start = startOfWeek(now);
  const list: WeekAgg[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() - i * 7);
    list.push({ week: d.getTime(), sessions: 0, volume: 0, sets: 0 });
  }
  for (const s of sessions) {
    if (s.status !== 'terminada') continue;
    const w = startOfWeek(s.startedAt);
    const row = list.find((x) => x.week === w);
    if (!row) continue;
    row.sessions++;
    row.volume += sessionVolume(s);
    row.sets += sessionSetCount(s);
  }
  return list;
}

/** Series por músculo en una semana: principal = 1, secundarios = 0,5 (regla 7: 9–15 por semana). */
export function setsPerMuscle(sessions: Session[], exercises: Map<string, Exercise>, weekStart: number) {
  const end = weekStart + 7 * 86400000 + 3600000 * 2; // margen por cambio de hora
  const out = new Map<Muscle, number>();
  for (const s of sessions) {
    if (s.status !== 'terminada' || s.startedAt < weekStart || s.startedAt >= end || startOfWeek(s.startedAt) !== weekStart) continue;
    for (const e of s.exercises) {
      const ex = exercises.get(e.exerciseId);
      if (!ex) continue;
      const n = doneSets(e).length;
      ex.muscles.forEach((m, i) => out.set(m, (out.get(m) ?? 0) + n * (i === 0 ? 1 : 0.5)));
    }
  }
  return out;
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  pecho: 'Pecho',
  espalda: 'Espalda',
  hombro: 'Hombro',
  hombro_post: 'Hombro post.',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebrazo: 'Antebrazo',
  abdomen: 'Abdomen',
  cuadriceps: 'Cuádriceps',
  femoral: 'Femoral',
  gluteo: 'Glúteo',
  pantorrilla: 'Pantorrilla',
};

export const EQUIP_LABEL: Record<Exercise['equipment'], string> = {
  maquina: 'Máquina',
  barra: 'Barra',
  mancuerna: 'Mancuernas',
  polea: 'Polea',
  corporal: 'Peso corporal',
  otro: 'Otro',
};

// ── Peso corporal

export interface TrendPoint {
  t: number;
  kg: number;
  trend: number;
}

/** Media móvil exponencial ponderada por días (α = 0,1 por día), estilo «Hacker's Diet». */
export function weightTrend(entries: { date: string; kg: number }[]): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const out: TrendPoint[] = [];
  let trend = 0;
  let prevT = 0;
  for (const e of sorted) {
    const [y, m, d] = e.date.split('-').map(Number);
    const t = new Date(y, m - 1, d).getTime();
    if (!out.length) trend = e.kg;
    else {
      const days = Math.max(1, Math.round((t - prevT) / 86400000));
      const alpha = 1 - Math.pow(0.9, days);
      trend = trend + alpha * (e.kg - trend);
    }
    prevT = t;
    out.push({ t, kg: e.kg, trend });
  }
  return out;
}

export function avgBetween(points: TrendPoint[], from: number, to: number) {
  const xs = points.filter((p) => p.t >= from && p.t < to).map((p) => p.kg);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
