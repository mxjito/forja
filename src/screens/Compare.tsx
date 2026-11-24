import { useSearchParams } from 'react-router-dom';
import { Page, Section } from '../components/ui';
import { useExercises, useSessions, useUnit } from '../lib/hooks';
import { exVolume, isLogged, sessionSetCount, sessionVolume } from '../lib/calc';
import { formatDate } from '../lib/dates';
import { showVolume } from '../lib/units';

export default function Compare() {
  const [p] = useSearchParams();
  const sessions = useSessions() ?? [];
  const exercises = useExercises();
  const { unit, w } = useUnit();
  const picked = [p.get('a'), p.get('b')].map((id) => sessions.find((s) => s.id === id)).filter(Boolean);
  if (picked.length < 2) return <Page back title="Comparar">{null}</Page>;
  const [a, b] = picked.sort((x, y) => x!.startedAt - y!.startedAt) as NonNullable<(typeof picked)[number]>[];
  const ids = [...new Set([...a.exercises, ...b.exercises].map((e) => e.exerciseId))];

  const delta = (x: number, y: number) => {
    if (!x) return null;
    const d = Math.round(((y - x) / x) * 100);
    return <span className={d > 0 ? 'text-good' : d < 0 ? 'text-bad' : 'text-mute'}>{d > 0 ? '+' : ''}{d} %</span>;
  };

  return (
    <Page back title="Comparar">
      <div className="mb-6 grid grid-cols-2 gap-2">
        {[a, b].map((s) => (
          <div key={s.id} className="card p-3">
            <div className="text-xs text-mute">{formatDate(s.startedAt)}</div>
            <div className="truncate font-semibold">{s.name}</div>
            <div className="mt-2 text-sm text-sub tnum">
              {sessionSetCount(s)} series · {showVolume(sessionVolume(s), unit)}
            </div>
          </div>
        ))}
      </div>
      <p className="mb-6 text-center text-sm text-sub">Volumen total: {delta(sessionVolume(a), sessionVolume(b)) ?? '—'}</p>

      <Section title="Por ejercicio">
        <div className="card divide-hair">
          {ids.map((id) => {
            const ea = a.exercises.find((e) => e.exerciseId === id);
            const eb = b.exercises.find((e) => e.exerciseId === id);
            const col = (e?: typeof ea) =>
              e ? (
                <div className="space-y-0.5 text-[13px] tnum">
                  {e.sets.filter(isLogged).map((s, i) => (
                    <div key={i}>
                      {w(s.weight)} × {s.reps ?? '?'}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] text-mute">—</div>
              );
            return (
              <div key={id} className="px-4 py-3.5">
                <div className="mb-2 flex justify-between gap-2">
                  <span className="text-[15px] font-medium leading-snug">{exercises.get(id)?.name}</span>
                  <span className="shrink-0 text-[13px] tnum">{ea && eb ? delta(exVolume(ea), exVolume(eb)) : null}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {col(ea)}
                  {col(eb)}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-xs text-mute">Pesos en {unit}. El porcentaje compara el volumen (peso × reps) de cada ejercicio.</p>
      </Section>
    </Page>
  );
}
