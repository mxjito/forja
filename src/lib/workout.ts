import { db, uid } from '../db/db';
import type { Exercise, Session, SessionExercise, SetEntry, Settings, Template, TemplateItem } from '../db/types';
import { bestsFor, lastPerformance, prsForSet, suggestion } from './calc';

export async function activeSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('activa').first();
}

function initialWeight(item: TemplateItem, ex: Exercise, sessions: Session[], index: number): number | null {
  const last = lastPerformance(ex.id, sessions);
  if (last) {
    const sug = suggestion(last.entry, ex);
    if (sug && sug.kind !== 'mantener') return sug.weightKg;
    const logged = last.entry.sets.filter((s) => s.done && s.weight != null);
    const ref = logged[index] ?? logged[logged.length - 1];
    if (ref) return ref.weight;
  }
  if (item.startKg != null) return item.startKg;
  if (ex.bodyweight) return 0;
  return null;
}

export function buildEntry(item: TemplateItem, ex: Exercise, sessions: Session[], settings: Settings): SessionExercise {
  const rest = item.restSec ?? (ex.compound ? settings.restCompound : settings.restIsolation);
  const sets: SetEntry[] = Array.from({ length: item.sets }, (_, i) => ({
    weight: initialWeight(item, ex, sessions, i),
    reps: ex.freeform ? 1 : null,
    done: false,
  }));
  return {
    key: uid('k'),
    exerciseId: ex.id,
    target: { sets: item.sets, repMin: item.repMin, repMax: item.repMax, restSec: rest, repsLabel: item.repsLabel },
    sets,
  };
}

export async function startSession(template: Template | null, settings: Settings): Promise<string> {
  const existing = await activeSession();
  if (existing) return existing.id;
  const sessions = await db.sessions.toArray();
  const exs = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
  const entries = (template?.items ?? [])
    .map((it) => {
      const ex = exs.get(it.exerciseId);
      return ex ? buildEntry(it, ex, sessions, settings) : null;
    })
    .filter((x): x is SessionExercise => !!x);
  const s: Session = {
    id: uid('s'),
    templateId: template?.id ?? null,
    name: template?.name ?? 'Entrenamiento libre',
    startedAt: Date.now(),
    status: 'activa',
    pausedMs: 0,
    exercises: entries,
    currentKey: entries[0]?.key,
  };
  await db.sessions.add(s);
  return s.id;
}

/** Aplica un cambio a la sesión y la guarda al instante (guardado automático). */
export async function mutate(id: string, fn: (s: Session) => void) {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id);
    if (!s) return;
    fn(s);
    await db.sessions.put(s);
  });
}

export async function completeSet(sessionId: string, key: string, index: number, settings: Settings) {
  const all = await db.sessions.toArray();
  let result: { prs: SetEntry['pr']; rest: number } = { prs: [], rest: 0 };
  await mutate(sessionId, (s) => {
    const e = s.exercises.find((x) => x.key === key);
    if (!e) return;
    const set = e.sets[index];
    set.done = true;
    set.doneAt = Date.now();
    const bests = bestsFor(e.exerciseId, all, s.id);
    const others = s.exercises.filter((x) => x.exerciseId === e.exerciseId).flatMap((x) => x.sets.filter((st) => st !== set && st.done));
    set.pr = prsForSet(set, bests, others);
    result = { prs: set.pr, rest: e.target.restSec };
    if (settings.autoRest && e.target.restSec > 0) {
      s.restEndsAt = Date.now() + e.target.restSec * 1000;
      s.restTotal = e.target.restSec;
    }
    s.currentKey = key;
  });
  return result;
}

export async function finishSession(id: string) {
  await mutate(id, (s) => {
    const now = Date.now();
    if (s.pausedAt) {
      s.pausedMs += now - s.pausedAt;
      s.pausedAt = undefined;
    }
    // Las series no validadas no cuentan; los ejercicios vacíos se quitan.
    s.exercises = s.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) }))
      .filter((e) => e.sets.length > 0);
    s.status = 'terminada';
    s.endedAt = now;
    s.restEndsAt = undefined;
    s.restTotal = undefined;
  });
}

export async function setPaused(id: string, paused: boolean) {
  await mutate(id, (s) => {
    const now = Date.now();
    if (paused === !!s.pausedAt) return;
    if (s.pausedAt) {
      s.pausedMs += now - s.pausedAt;
      if (s.restEndsAt) s.restEndsAt += now - s.pausedAt;
      s.pausedAt = undefined;
    } else s.pausedAt = now;
  });
}
