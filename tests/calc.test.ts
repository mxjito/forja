import { describe, expect, it } from 'vitest';
import { bestsFor, e1rm, exerciseSeries, lastPerformance, prsForSet, sessionVolume, suggestion, weightTrend, setsPerMuscle } from '../src/lib/calc';
import { EXERCISES, HISTORY, TEMPLATES } from '../src/data/program';
import { validateBackup } from '../src/lib/backup';
import type { Session, SessionExercise } from '../src/db/types';
import { startOfWeek } from '../src/lib/dates';

const ex = (id: string) => EXERCISES.find((e) => e.id === id)!;
const entry = (exerciseId: string, sets: [number, number][], repMin = 8, repMax = 10, target = 3): SessionExercise => ({
  key: 'k',
  exerciseId,
  target: { sets: target, repMin, repMax, restSec: 90 },
  sets: sets.map(([weight, reps]) => ({ weight, reps, done: true })),
});
const session = (id: string, t: string, exercises: SessionExercise[]): Session => ({ id, templateId: null, name: id, startedAt: new Date(t).getTime(), status: 'terminada', pausedMs: 0, exercises });

describe('programa del Excel', () => {
  it('tiene las 5 rutinas con todos los ejercicios del Excel', () => {
    expect(TEMPLATES.map((t) => t.items.length)).toEqual([7, 6, 7, 6, 8]);
    for (const t of TEMPLATES) for (const i of t.items) expect(EXERCISES.some((e) => e.id === i.exerciseId)).toBe(true);
  });
  it('conserva los pesos iniciales', () => {
    const t1 = TEMPLATES[0].items;
    expect(t1[0]).toMatchObject({ sets: 3, repMin: 8, repMax: 10, startKg: 40 });
    expect(t1[2].startLabel).toBe('45–50 kg');
  });
});

describe('progresión (reglas 2 y 3)', () => {
  it('sube cuando todas las series llegan al máximo', () => {
    const s = suggestion(entry('press-pecho-maquina', [[35, 12], [35, 12], [35, 12]]), ex('press-pecho-maquina'));
    expect(s).toMatchObject({ kind: 'subir', weightKg: 37.5 });
  });
  it('mancuernas suben 2 kg (siguiente mancuerna)', () => {
    expect(suggestion(entry('curl-mancuerna', [[12, 12], [12, 12], [12, 12]], 10, 12), ex('curl-mancuerna'))?.weightKg).toBe(14);
  });
  it('mantiene si falta alguna serie en el máximo', () => {
    expect(suggestion(entry('press-pecho-maquina', [[40, 10], [40, 9], [40, 8]]), ex('press-pecho-maquina'))?.kind).toBe('mantener');
  });
  it('no sube si se hicieron menos series de las previstas', () => {
    expect(suggestion(entry('press-pecho-maquina', [[40, 10], [40, 10]]), ex('press-pecho-maquina'))?.kind).toBe('mantener');
  });
  it('baja si la mayoría no llega al mínimo', () => {
    expect(suggestion(entry('curl-mancuerna', [[14, 7], [14, 6], [14, 8]], 10, 12), ex('curl-mancuerna'))).toMatchObject({ kind: 'bajar', weightKg: 12 });
  });
  it('no sugiere nada con reps desconocidas (historial importado)', () => {
    const e = HISTORY[2].exercises.find((x) => x.exerciseId === 'jalon-pecho')!;
    expect(suggestion(e, ex('jalon-pecho'))).toBeNull();
  });
  it('el historial real del 23 nov sugiere subir el press de pecho en máquina', () => {
    const last = lastPerformance('press-pecho-maquina', HISTORY)!;
    expect(suggestion(last.entry, ex('press-pecho-maquina'))).toMatchObject({ kind: 'subir', weightKg: 37.5 });
  });
});

describe('1RM y récords', () => {
  it('Epley', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBe(133.5);
    expect(e1rm(100, 20)).toBeNull();
  });
  const hist = [session('a', '2026-11-20', [entry('curl-mancuerna', [[12, 8], [12, 8]])])];
  it('detecta récord de peso', () => {
    expect(prsForSet({ weight: 14, reps: 6, done: true }, bestsFor('curl-mancuerna', hist))).toEqual(['peso']);
  });
  it('detecta récord de reps con el mismo peso', () => {
    expect(prsForSet({ weight: 12, reps: 10, done: true }, bestsFor('curl-mancuerna', hist))).toContain('e1rm');
  });
  it('no marca récord de 1RM si antes no había reps apuntadas', () => {
    const imported = [session('b', '2026-11-21', [entry('sentadilla', [[60, 0]])])];
    imported[0].exercises[0].sets[0].reps = null;
    expect(prsForSet({ weight: 60, reps: 8, done: true }, bestsFor('sentadilla', imported))).toEqual([]);
  });
  it('no marca récord la primera vez', () => {
    expect(prsForSet({ weight: 50, reps: 10, done: true }, bestsFor('sentadilla', []))).toEqual([]);
  });
  it('no repite récord ya conseguido en la misma sesión', () => {
    const b = bestsFor('curl-mancuerna', hist);
    expect(prsForSet({ weight: 14, reps: 6, done: true }, b, [{ weight: 14, reps: 6, done: true }])).toEqual([]);
  });
});

describe('volumen y series', () => {
  it('ignora series sin reps en el volumen', () => {
    expect(sessionVolume(HISTORY[0])).toBe(0);
    expect(sessionVolume(HISTORY[2])).toBe(24 * 8 + 24 * 6 + 12 * 8 * 3 + 6 * 12 + 35 * 12 * 3);
  });
  it('series por músculo: principal 1, secundario 0,5', () => {
    const map = new Map(EXERCISES.map((e) => [e.id, e]));
    const m = setsPerMuscle(HISTORY, map, startOfWeek(new Date('2026-11-23T12:00').getTime()));
    // 23 nov (lunes): press banca 2 + press máquina 3 → pecho 5
    expect(m.get('pecho')).toBe(5);
  });
  it('serie temporal por ejercicio en orden cronológico', () => {
    const s = exerciseSeries('curl-mancuerna', HISTORY);
    expect(s.map((p) => p.topWeight)).toEqual([12, 12]);
    expect(s[0].t).toBeLessThan(s[1].t);
  });
});

describe('peso corporal', () => {
  it('la tendencia suaviza fluctuaciones', () => {
    const t = weightTrend([
      { date: '2026-11-21', kg: 80 },
      { date: '2026-11-22', kg: 82 },
      { date: '2026-11-23', kg: 80 },
    ]);
    expect(t[1].trend).toBeCloseTo(80.2, 5);
    expect(t[2].trend).toBeLessThan(80.2);
    expect(t[2].trend).toBeGreaterThan(80);
  });
});

describe('copia de seguridad', () => {
  it('rechaza archivos ajenos', () => {
    expect(() => validateBackup({ foo: 1 })).toThrow();
    expect(() => validateBackup({ app: 'forja', version: 1, data: { exercises: [], templates: [], sessions: [{ id: 1 }], bodyweights: [], measurements: [], settings: [] } })).toThrow(/Sesión 1/);
  });
  it('acepta una copia válida', () => {
    const b = { app: 'forja', version: 1, exportedAt: '', data: { exercises: EXERCISES, templates: TEMPLATES, sessions: HISTORY, bodyweights: [], measurements: [], settings: [] } };
    expect(validateBackup(JSON.parse(JSON.stringify(b))).data.sessions).toHaveLength(3);
  });
});
