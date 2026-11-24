import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db, defaultSettings } from '../db/db';
import type { Exercise, Settings } from '../db/types';
import { showW, showWU, type Unit } from './units';

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get('main'), []);
  return s ?? defaultSettings();
}

export const saveSettings = (patch: Partial<Settings>) => db.settings.update('main', patch);

export function useExercises() {
  const list = useLiveQuery(() => db.exercises.toArray(), []);
  return useMemo(() => new Map<string, Exercise>((list ?? []).map((e) => [e.id, e])), [list]);
}

export const useTemplates = () => useLiveQuery(() => db.templates.orderBy('order').toArray(), []);
export const useSessions = () => useLiveQuery(() => db.sessions.toArray(), []);
export const useBodyweights = () => useLiveQuery(() => db.bodyweights.orderBy('date').toArray(), []);
export const useActive = () => useLiveQuery(() => db.sessions.where('status').equals('activa').first(), []);

export function useNow(ms = 1000, enabled = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    const vis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [ms, enabled]);
  return now;
}

/** Formateadores de peso ligados a la unidad elegida. */
export function useUnit() {
  const { unit } = useSettings();
  return useMemo(
    () => ({ unit: unit as Unit, w: (kg: number | null | undefined) => showW(kg, unit), wu: (kg: number | null | undefined) => showWU(kg, unit) }),
    [unit],
  );
}

/** Aplica tema y acento al documento. */
export function useApplyTheme(s: Settings) {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const theme = s.theme === 'sistema' ? (mq.matches ? 'claro' : 'oscuro') : s.theme;
      root.dataset.theme = theme;
      root.dataset.accent = s.accent;
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim().split(/\s+/).join(',');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${bg})`);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [s.theme, s.accent]);
}
