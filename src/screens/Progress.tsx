import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { Page, Section, Segmented, Empty, Stat } from '../components/ui';
import { BarChart, RangeBars, LineChart } from '../components/charts';
import { useBodyweights, useExercises, useSessions, useUnit } from '../lib/hooks';
import { bestsFor, exerciseSeries, finished, MUSCLE_LABEL, sessionDuration, sessionSetCount, sessionVolume, setsPerMuscle, weeklyAgg, weightTrend } from '../lib/calc';
import { formatShort, startOfWeek, formatMinutes } from '../lib/dates';
import { fmtNum, showVolume, toUnit } from '../lib/units';
import type { Muscle } from '../db/types';

type Tab = 'resumen' | 'ejercicios' | 'records';

export default function Progress() {
  const [tab, setTab] = useState<Tab>('resumen');
  return (
    <Page title="Progreso">
      <div className="mb-6">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'resumen', label: 'Resumen' },
            { value: 'ejercicios', label: 'Ejercicios' },
            { value: 'records', label: 'Récords' },
          ]}
        />
      </div>
      {tab === 'resumen' ? <Overview /> : tab === 'ejercicios' ? <ExerciseList /> : <Records />}
    </Page>
  );
}

function Overview() {
  const sessions = useSessions() ?? [];
  const exercises = useExercises();
  const weights = useBodyweights() ?? [];
  const { unit } = useUnit();
  const [weekOffset, setWeekOffset] = useState(0);
  const now = Date.now();
  const done = finished(sessions);
  const weeks = useMemo(() => weeklyAgg(sessions, 12, now), [sessions, now]);

  const months = useMemo(() => {
    const out: { key: string; label: string; n: number }[] = [];
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({ key: `${m.getFullYear()}-${m.getMonth()}`, label: new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(m).replace('.', ''), n: 0 });
    }
    for (const s of done) {
      const m = new Date(s.startedAt);
      const row = out.find((x) => x.key === `${m.getFullYear()}-${m.getMonth()}`);
      if (row) row.n++;
    }
    return out;
  }, [done]);

  const weekStart = startOfWeek(now) - weekOffset * 7 * 86400000;
  const perMuscle = useMemo(() => setsPerMuscle(sessions, exercises, startOfWeek(weekStart + 3600000 * 3)), [sessions, exercises, weekStart]);
  const MAIN: Muscle[] = ['pecho', 'espalda', 'hombro', 'biceps', 'triceps', 'cuadriceps', 'femoral', 'gluteo', 'pantorrilla', 'abdomen', 'antebrazo', 'hombro_post'];
  const rows = MAIN.map((m) => ({ label: MUSCLE_LABEL[m], value: Math.round((perMuscle.get(m) ?? 0) * 2) / 2 }));
  const trend = weightTrend(weights);

  if (!done.length) return <Empty icon={<BarChart3 size={28} />} title="Aún no hay datos" body="Las estadísticas se calculan solo con tus entrenamientos reales. Termina tu primera sesión para verlas." />;

  const totalVol = done.reduce((a, s) => a + sessionVolume(s), 0);
  const totalSets = done.reduce((a, s) => a + sessionSetCount(s), 0);
  const totalTime = done.filter((s) => !s.imported).reduce((a, s) => a + sessionDuration(s), 0);

  return (
    <>
      <div className="mb-7 grid grid-cols-2 gap-3">
        <Stat label="Entrenamientos" value={done.length} />
        <Stat label="Series totales" value={totalSets} />
        <Stat label="Volumen total" value={showVolume(totalVol, unit).split(' ')[0]} unit={showVolume(totalVol, unit).split(' ')[1]} />
        <Stat label="Tiempo" value={formatMinutes(totalTime)} foot="Sin contar sesiones importadas" />
      </div>

      <Section title="Entrenamientos por semana">
        <div className="card p-4">
          <BarChart
            data={weeks.map((w, i) => ({ key: w.week, label: formatShort(w.week), value: w.sessions, highlight: i === weeks.length - 1, tip: <><div className="text-mute">Semana del {formatShort(w.week)}</div><div className="font-semibold text-ink">{w.sessions} entrenamiento{w.sessions === 1 ? '' : 's'}</div></> }))}
            fmtY={(v) => fmtNum(v, 0)}
          />
        </div>
      </Section>

      <Section title="Volumen por semana">
        <div className="card p-4">
          <BarChart
            data={weeks.map((w, i) => ({ key: w.week, label: formatShort(w.week), value: toUnit(w.volume, unit), highlight: i === weeks.length - 1, tip: <><div className="text-mute">Semana del {formatShort(w.week)}</div><div className="font-semibold text-ink tnum">{showVolume(w.volume, unit)}</div><div className="text-mute">{w.sets} series</div></> }))}
            fmtY={(v) => (v >= 1000 ? `${fmtNum(v / 1000, 1)}k` : fmtNum(v, 0))}
          />
          <p className="mt-2 text-xs text-mute">Volumen = peso × reps de las series con datos completos.</p>
        </div>
      </Section>

      <Section
        title="Series por músculo"
        action={
          <div className="flex gap-1">
            {[0, 1].map((o) => (
              <button key={o} onClick={() => setWeekOffset(o)} className={`chip ${weekOffset === o ? '!bg-ink !text-bg' : ''}`}>
                {o === 0 ? 'Esta semana' : 'Anterior'}
              </button>
            ))}
          </div>
        }
      >
        <div className="card p-4">
          <RangeBars rows={rows} band={[9, 15]} max={20} />
          <p className="mt-4 text-xs text-mute">Zona verde: 9–15 series fuertes por semana (regla 12). El músculo principal cuenta 1 serie y los secundarios 0,5.</p>
        </div>
      </Section>

      <Section title="Regularidad mensual">
        <div className="card p-4">
          <BarChart data={months.map((m, i) => ({ key: m.key, label: m.label, value: m.n, highlight: i === months.length - 1 }))} fmtY={(v) => fmtNum(v, 0)} height={130} />
        </div>
      </Section>

      {trend.length > 1 && (
        <Section title="Peso corporal" action={<Link to="/cuerpo" className="text-sm text-accent">Detalle</Link>}>
          <div className="card p-4">
            <LineChart data={trend.map((p) => ({ x: p.t, y: toUnit(p.kg, unit), y2: toUnit(p.trend, unit) }))} fmtX={formatShort} fmtY={(v) => fmtNum(v, 1)} height={140} primaryLabel="Pesadas" secondaryLabel="Tendencia" />
          </div>
        </Section>
      )}
    </>
  );
}

function ExerciseList() {
  const sessions = useSessions() ?? [];
  const exercises = useExercises();
  const { unit, wu } = useUnit();
  const rows = useMemo(() => {
    return [...exercises.values()]
      .map((ex) => ({ ex, pts: exerciseSeries(ex.id, sessions) }))
      .filter((r) => r.pts.length)
      .sort((a, b) => b.pts[b.pts.length - 1].t - a.pts[a.pts.length - 1].t);
  }, [exercises, sessions]);
  if (!rows.length) return <Empty title="Sin ejercicios registrados" />;
  return (
    <div className="card divide-hair">
      {rows.map(({ ex, pts }) => {
        const last = pts[pts.length - 1];
        const first = pts[0];
        const dir = pts.length < 2 ? 0 : Math.sign(last.topWeight - first.topWeight);
        const Icon = dir > 0 ? TrendingUp : dir < 0 ? TrendingDown : Minus;
        return (
          <Link key={ex.id} to={`/ejercicio/${ex.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-raised">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{ex.name}</span>
              <span className="block text-[13px] text-sub tnum">
                {pts.length} sesión{pts.length === 1 ? '' : 'es'} · último {wu(last.topWeight)}
                {last.topReps != null ? ` × ${last.topReps}` : ''}
              </span>
            </span>
            {pts.length > 1 && (
              <span className={`inline-flex items-center gap-1 text-[13px] tnum ${dir > 0 ? 'text-good' : dir < 0 ? 'text-bad' : 'text-mute'}`}>
                <Icon size={15} />
                {dir !== 0 && `${dir > 0 ? '+' : '−'}${wu(Math.abs(last.topWeight - first.topWeight)).replace(` ${unit}`, '')}`}
              </span>
            )}
            <ChevronRight size={18} className="text-mute" />
          </Link>
        );
      })}
    </div>
  );
}

function Records() {
  const sessions = useSessions() ?? [];
  const exercises = useExercises();
  const { w, unit } = useUnit();
  const rows = useMemo(
    () =>
      [...exercises.values()]
        .map((ex) => ({ ex, b: bestsFor(ex.id, sessions) }))
        .filter((r) => r.b.count > 0)
        .sort((a, b) => a.ex.name.localeCompare(b.ex.name, 'es')),
    [exercises, sessions],
  );
  if (!rows.length) return <Empty title="Sin récords todavía" />;
  return (
    <>
      <div className="card divide-hair">
        <div className="grid grid-cols-[1fr_64px_64px] gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-mute">
          <span>Ejercicio</span>
          <span className="text-right">Máx.</span>
          <span className="text-right">1RM est.</span>
        </div>
        {rows.map(({ ex, b }) => (
          <Link key={ex.id} to={`/ejercicio/${ex.id}`} className="grid grid-cols-[1fr_64px_64px] items-center gap-2 px-4 py-3 active:bg-raised">
            <span className="truncate text-[14px]">{ex.name}</span>
            <span className="text-right text-[14px] font-semibold tnum">{b.maxWeight ? w(b.maxWeight) : '—'}</span>
            <span className="text-right text-[14px] text-sub tnum">{b.maxE1rm ? w(b.maxE1rm) : '—'}</span>
          </Link>
        ))}
      </div>
      <p className="mt-2 px-1 text-xs text-mute">Pesos en {unit}. 1RM estimado (Epley) solo con series de 1–12 reps: es una estimación.</p>
    </>
  );
}
