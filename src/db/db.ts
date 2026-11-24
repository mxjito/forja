import Dexie, { type Table } from 'dexie';
import type { BodyWeight, Exercise, Measurement, Session, Settings, Template } from './types';
import { BODYWEIGHT, EXERCISES, HISTORY, TEMPLATES, WEEK_PLAN } from '../data/program';

export const SEED_VERSION = 1;

export class ForjaDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<Template, string>;
  sessions!: Table<Session, string>;
  bodyweights!: Table<BodyWeight, string>;
  measurements!: Table<Measurement, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'forja') {
    super(name);
    this.version(1).stores({
      exercises: 'id, name',
      templates: 'id, order',
      sessions: 'id, startedAt, status, templateId',
      bodyweights: 'id, date',
      measurements: 'id, date',
      settings: 'id',
    });
    this.on('populate', (tx) => {
      tx.table('exercises').bulkAdd(EXERCISES);
      tx.table('templates').bulkAdd(TEMPLATES);
      tx.table('sessions').bulkAdd(HISTORY);
      tx.table('bodyweights').bulkAdd(BODYWEIGHT);
      tx.table('settings').add(defaultSettings());
    });
  }
}

export function defaultSettings(): Settings {
  return {
    id: 'main',
    unit: 'kg',
    theme: 'oscuro',
    accent: 'lima',
    weekPlan: { ...WEEK_PLAN },
    restCompound: 150,
    restIsolation: 90,
    autoRest: true,
    sound: true,
    vibrate: true,
    keepAwake: true,
    heightCm: 185,
    goalSessionsPerWeek: 4,
    proteinMin: 140,
    proteinMax: 170,
    maintenanceKcal: 2800,
    surplusKcal: 300,
    programStart: '2026-11-21',
    seedVersion: SEED_VERSION,
  };
}

export const db = new ForjaDB();

export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Pide al navegador que no borre los datos automáticamente (IndexedDB persistente). */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* no soportado */
  }
  return null;
}
