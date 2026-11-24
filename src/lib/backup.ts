import { db, defaultSettings } from '../db/db';
import type { BodyWeight, Exercise, Measurement, Session, Settings, Template } from '../db/types';
import { dayKey } from './dates';

export interface Backup {
  app: 'forja';
  version: 1;
  exportedAt: string;
  data: {
    exercises: Exercise[];
    templates: Template[];
    sessions: Session[];
    bodyweights: BodyWeight[];
    measurements: Measurement[];
    settings: Settings[];
  };
}

export async function buildBackup(): Promise<Backup> {
  const [exercises, templates, sessions, bodyweights, measurements, settings] = await Promise.all([
    db.exercises.toArray(),
    db.templates.toArray(),
    db.sessions.toArray(),
    db.bodyweights.toArray(),
    db.measurements.toArray(),
    db.settings.toArray(),
  ]);
  return { app: 'forja', version: 1, exportedAt: new Date().toISOString(), data: { exercises, templates, sessions, bodyweights, measurements, settings } };
}

/** Descarga (o comparte en el móvil) un archivo JSON con todos los datos. */
export async function exportBackup(): Promise<'compartido' | 'descargado' | 'cancelado'> {
  const backup = await buildBackup();
  const json = JSON.stringify(backup, null, 1);
  const name = `forja-copia-${dayKey(Date.now())}.json`;
  const file = new File([json], name, { type: 'application/json' });
  let result: 'compartido' | 'descargado' | 'cancelado' = 'descargado';
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: 'Copia de seguridad de Forja' });
      result = 'compartido';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelado';
      download(file);
    }
  } else download(file);
  await db.settings.update('main', { lastExportAt: Date.now() });
  return result;
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const isArr = (x: unknown): x is unknown[] => Array.isArray(x);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Comprueba que el archivo es una copia válida. Lanza un Error con un mensaje legible si no. */
export function validateBackup(raw: unknown): Backup {
  if (!isObj(raw) || raw.app !== 'forja' || !isObj(raw.data)) throw new Error('El archivo no es una copia de Forja.');
  if (raw.version !== 1) throw new Error('Versión de copia no compatible.');
  const d = raw.data;
  for (const k of ['exercises', 'templates', 'sessions', 'bodyweights', 'measurements', 'settings']) if (!isArr(d[k])) throw new Error(`Falta la sección «${k}».`);
  const sessions = d.sessions as unknown[];
  sessions.forEach((s, i) => {
    if (!isObj(s) || typeof s.id !== 'string' || typeof s.startedAt !== 'number' || !isArr(s.exercises)) throw new Error(`Sesión ${i + 1} dañada.`);
    for (const e of s.exercises) if (!isObj(e) || typeof e.exerciseId !== 'string' || !isArr(e.sets)) throw new Error(`Sesión ${i + 1}: ejercicio dañado.`);
  });
  (d.exercises as unknown[]).forEach((e, i) => {
    if (!isObj(e) || typeof e.id !== 'string' || typeof e.name !== 'string' || !isArr(e.muscles)) throw new Error(`Ejercicio ${i + 1} dañado.`);
  });
  (d.templates as unknown[]).forEach((t, i) => {
    if (!isObj(t) || typeof t.id !== 'string' || !isArr(t.items)) throw new Error(`Rutina ${i + 1} dañada.`);
  });
  (d.bodyweights as unknown[]).forEach((b, i) => {
    if (!isObj(b) || typeof b.date !== 'string' || typeof b.kg !== 'number') throw new Error(`Pesada ${i + 1} dañada.`);
  });
  return raw as unknown as Backup;
}

export function summarize(b: Backup) {
  const done = b.data.sessions.filter((s) => s.status === 'terminada').length;
  return `${done} entrenamientos, ${b.data.bodyweights.length} pesadas, ${b.data.templates.length} rutinas`;
}

/** Sustituye TODOS los datos por los de la copia (en una sola transacción: o todo o nada). */
export async function restoreBackup(b: Backup) {
  await db.transaction('rw', [db.exercises, db.templates, db.sessions, db.bodyweights, db.measurements, db.settings], async () => {
    await Promise.all([db.exercises.clear(), db.templates.clear(), db.sessions.clear(), db.bodyweights.clear(), db.measurements.clear(), db.settings.clear()]);
    await db.exercises.bulkPut(b.data.exercises);
    await db.templates.bulkPut(b.data.templates);
    await db.sessions.bulkPut(b.data.sessions);
    await db.bodyweights.bulkPut(b.data.bodyweights);
    await db.measurements.bulkPut(b.data.measurements);
    const s = b.data.settings.find((x) => x.id === 'main');
    await db.settings.put({ ...defaultSettings(), ...(s ?? {}), id: 'main' });
  });
}
