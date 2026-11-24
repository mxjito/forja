import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowUpRight, ChevronRight, CloudOff, Play, Settings as Gear, Trophy, TrendingUp, Moon } from 'lucide-react';
import { Page, Section, Sheet, Stat, useToast } from '../components/ui';
import { ConsistencyGrid } from '../components/charts';
import { useBodyweights, useExercises, useSessions, useSettings, useTemplates, useUnit, useActive } from '../lib/hooks';
import { DAY_NAMES, dayKey, formatLong, relativeDay, formatMinutes, WEEK_ORDER } from '../lib/dates';
import { finished, lastPerformance, sessionDuration, sessionSetCount, sessionVolume, suggestion, weeklyAgg, PR_LABEL } from '../lib/calc';
import { showVolume } from '../lib/units';
import { startSession } from '../lib/workout';
import type { Template } from '../db/types';
import { REST_NOTES } from '../data/program';

export function useStartWorkout() {
  const nav = useNavigate();
  const settings = useSettings();
  return async (t: Template | null) => {
    await startSession(t, settings);
    nav('/entreno');
  };
}

export function estimateMinutes(t: Template) {
  const sec = t.items.reduce((a, i) => a + i.sets * (45 + i.restSec), 0);
  return Math.round(sec / 60 / 5) * 5;
}

export default function Home() {
  const settings = useSettings();
  const templates = useTemplates() ?? [];
  const sessions = useSessions();
  const exercises = useExercises();
  const weights = useBodyweights() ?? [];
  const active = useActive();
  const { unit, wu } = useUnit();
  const start = useStartWorkout();
  const nav = useNavigate();
  const toast = useToast();
  const [pick, setPick] = useState(false);
  const now = Date.now();
  const dow = new Date().getDay();
  const todayId = settings.weekPlan[dow];
  const today = templates.find((t) => t.id === todayId) ?? null;

  const done = useMemo(() => finished(sessions ?? []), [sessions]);
  const doneToday = done.find((s) => dayKey(s.startedAt) === dayKey(now));

  const next = useMemo(() => {
    for (let i = 1; i <= 7; i++) {
      const d = (dow + i) % 7;
      const id = settings.weekPlan[d];
      const t = templates.find((x) => x.id === id);
      if (t) return { t, day: d, inDays: i };
    }
    return null;
  }, [dow, settings.weekPlan, templates]);

  const upgrades = useMemo(() => {
    if (!today || !sessions) return [];
    return today.items
      .map((it) => {
        const ex = exercises.get(it.exerciseId);
        const last = ex && lastPerformance(it.exerciseId, sessions);
        const sug = ex && last ? suggestion(last.entry, ex) : null;
        return ex && sug && sug.kind !== 'mantener' ? { ex, sug } : null;
      })
      .filter(Boolean) as { ex: NonNullable<ReturnType<typeof exercises.get>>; sug: NonNullable<ReturnType<typeof suggestion>> }[];
  }, [today, sessions, exercises]);

  const weeks = useMemo(() => weeklyAgg(sessions ?? [], 2, now), [sessions, now]);
  const thisWeek = weeks[1];
  const lastWeek = weeks[0];
  const trained = useMemo(() => {
    const m = new Map<string, number>();
    done.forEach((s) => m.set(dayKey(s.startedAt), (m.get(dayKey(s.startedAt)) ?? 0) + 1));
    return m;
  }, [done]);

  const streak = useMemo(() => {
    // Semanas consecutivas (contando hacia atrás desde la anterior) con el objetivo cumplido.
    const agg = weeklyAgg(sessions ?? [], 52, now);
    let n = 0;
    const cur = agg[agg.length - 1];
    if (cur.sessions >= settings.goalSessionsPerWeek) n++;
    for (let i = agg.length - 2; i >= 0; i--) {
      if (agg[i].sessions >= settings.goalSessionsPerWeek) n++;
      else break;
    }
    return n;
  }, [sessions, now, settings.goalSessionsPerWeek]);

  const recentPRs = useMemo(() => {
    const out: { t: number; exId: string; label: string; w: number; r: number | null; sid: string }[] = [];
    for (const s of done) {
      for (const e of s.exercises)
        for (const st of e.sets)
          if (st.pr?.length) out.push({ t: s.startedAt, exId: e.exerciseId, label: PR_LABEL[st.pr[0]], w: st.weight ?? 0, r: st.reps, sid: s.id });
      if (out.length >= 4) break;
    }
    return out.slice(0, 4);
  }, [done]);

  const bwFirst = weights[0];
  const bwLast = weights[weights.length - 1];
  const last = done[0];
  const needsBackup = done.length > 0 && (!settings.lastExportAt || now - settings.lastExportAt > 14 * 86400000);

  const volDelta = lastWeek.volume > 0 ? Math.round(((thisWeek.volume - lastWeek.volume) / lastWeek.volume) * 100) : null;

  return (
    <Page
      subtitle={formatLong(now)}
      title={doneToday ? 'Buen trabajo' : today ? `Hoy toca ${today.name}` : 'Día de descanso'}
      actions={
        <button className="btn-icon" aria-label="Ajustes" onClick={() => nav('/ajustes')}>
          <Gear size={21} />
        </button>
      }
    >
      {/* ── Hoy */}
      <Section>
        <div className="card overflow-hidden">
          {active ? (
            <div className="p-5">
              <div className="eyebrow text-accent">Sesión en curso</div>
              <div className="mt-1 text-xl font-semibold">{active.name}</div>
              <p className="mt-1 text-sm text-sub">Todo lo que apuntaste está guardado. Sigue donde lo dejaste.</p>
              <button className="btn-primary mt-5 w-full uppercase tracking-wide" onClick={() => nav('/entreno')}>
                <Play size={18} fill="currentColor" /> Reanudar entrenamiento
              </button>
            </div>
          ) : doneToday ? (
            <Link to={`/historial/${doneToday.id}`} className="block p-5">
              <div className="eyebrow text-good">Completado hoy</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xl font-semibold">{doneToday.name}</span>
                <ChevronRight size={20} className="text-mute" />
              </div>
              <div className="mt-3 flex gap-5 text-sm text-sub tnum">
                <span>{formatMinutes(sessionDuration(doneToday))}</span>
                <span>{sessionSetCount(doneToday)} series</span>
                <span>{showVolume(sessionVolume(doneToday), unit)}</span>
              </div>
              {next && (
                <div className="mt-4 border-t hairline pt-3 text-sm text-sub">
                  Próximo: <span className="text-ink">{next.t.name}</span> · {next.inDays === 1 ? 'mañana' : DAY_NAMES[next.day].toLowerCase()}
                </div>
              )}
            </Link>
          ) : today ? (
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="eyebrow">{today.optional ? 'Opcional · ' : ''}{DAY_NAMES[dow]}</div>
                  <div className="mt-1 text-[22px] font-semibold tracking-tight">{today.name}</div>
                  <div className="mt-0.5 text-sm text-sub">{today.focus}</div>
                </div>
                <Link to={`/rutinas/${today.id}`} className="btn-ghost -mr-2 -mt-1 text-accent">
                  Ver
                </Link>
              </div>
              <div className="mt-4 flex gap-5 text-sm text-sub tnum">
                <span>
                  <b className="text-ink font-semibold">{today.items.length}</b> ejercicios
                </span>
                <span>
                  <b className="text-ink font-semibold">{today.items.reduce((a, i) => a + i.sets, 0)}</b> series
                </span>
                <span>~{estimateMinutes(today)} min</span>
              </div>
              <ol className="mt-4 space-y-1.5 text-[14px] text-sub">
                {today.items.slice(0, 4).map((it, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-4 text-mute tnum">{i + 1}</span>
                    <span className="truncate text-ink/90">{exercises.get(it.exerciseId)?.name}</span>
                  </li>
                ))}
                {today.items.length > 4 && <li className="pl-7 text-mute">y {today.items.length - 4} más</li>}
              </ol>
              <button className="btn-primary mt-5 w-full uppercase tracking-wide" onClick={() => start(today)}>
                <Play size={18} fill="currentColor" /> Comenzar entrenamiento
              </button>
              <button className="btn-ghost mt-1 w-full" onClick={() => setPick(true)}>
                Hacer otra rutina
              </button>
            </div>
          ) : (
            <div className="p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-raised text-sub">
                  <Moon size={19} />
                </span>
                <div>
                  <div className="font-semibold">{REST_NOTES[dow] ?? 'Descanso.'}</div>
                  {next && (
                    <div className="text-sm text-sub">
                      Próximo: {next.t.name} · {next.inDays === 1 ? 'mañana' : DAY_NAMES[next.day].toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
              <button className="btn-secondary mt-5 w-full" onClick={() => setPick(true)}>
                Entrenar igualmente
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* ── Progresión sugerida para hoy */}
      {!active && !doneToday && upgrades.length > 0 && (
        <Section title="Para hoy">
          <div className="card divide-hair">
            {upgrades.map(({ ex, sug }) => (
              <Link key={ex.id} to={`/ejercicio/${ex.id}`} className="flex items-center gap-3 px-4 py-3.5">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${sug.kind === 'subir' ? 'bg-accent/15 text-accent' : 'bg-warn/15 text-warn'}`}>
                  <TrendingUp size={16} className={sug.kind === 'bajar' ? 'rotate-180' : ''} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{ex.name}</span>
                  <span className="block text-[13px] text-sub">{sug.reason}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[11px] uppercase tracking-wide text-mute">{sug.kind === 'subir' ? 'Prueba' : 'Baja a'}</span>
                  <span className="block font-semibold tnum">{wu(sug.weightKg)}</span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* ── Resumen */}
      <Section title="Resumen">
        <div className="grid grid-cols-2 gap-3">
          <Link to="/cuerpo">
            <Stat
              label="Peso"
              value={bwLast ? wu(bwLast.kg).replace(` ${unit}`, '') : '—'}
              unit={bwLast ? unit : undefined}
              foot={
                bwFirst && bwLast && bwFirst !== bwLast
                  ? `${bwLast.kg - bwFirst.kg >= 0 ? '+' : '−'}${wu(Math.abs(bwLast.kg - bwFirst.kg))} desde el inicio`
                  : bwLast
                    ? relativeDay(new Date(bwLast.date + 'T12:00').getTime())
                    : 'Añade tu peso'
              }
            />
          </Link>
          <Link to="/historial">
            <Stat label="Entrenamientos" value={done.length} foot={`${thisWeek.sessions} de ${settings.goalSessionsPerWeek} esta semana`} />
          </Link>
          <Link to="/progreso">
            <Stat
              label="Volumen semana"
              value={showVolume(thisWeek.volume, unit).split(' ')[0]}
              unit={showVolume(thisWeek.volume, unit).split(' ')[1]}
              foot={volDelta == null ? 'Peso × reps de la semana' : `${volDelta >= 0 ? '+' : ''}${volDelta} % vs semana pasada`}
            />
          </Link>
          <Link to="/progreso">
            <Stat label="Series semana" value={thisWeek.sets} foot={`${lastWeek.sets} la semana pasada`} />
          </Link>
        </div>
      </Section>

      {/* ── Regularidad */}
      <Section title="Regularidad" action={<span className="text-xs text-sub tnum">{streak > 0 ? `${streak} sem. cumpliendo objetivo` : `Objetivo: ${settings.goalSessionsPerWeek}/semana`}</span>}>
        <div className="card p-4">
          <ConsistencyGrid weeks={14} trained={trained} now={now} onPick={(d, n) => toast(`${relativeDay(new Date(d + 'T12:00').getTime())}: ${n ? `${n} entrenamiento${n > 1 ? 's' : ''}` : 'sin entrenar'}`)} />
          <div className="mt-3 flex items-center justify-between text-xs text-mute">
            <span>Últimas 14 semanas</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-raised" /> Descanso
              <span className="ml-2 h-2.5 w-2.5 rounded-[3px] bg-accent" /> Entreno
            </span>
          </div>
        </div>
      </Section>

      {/* ── Último / próximo */}
      <Section title="Actividad">
        <div className="card divide-hair">
          {last && (
            <Link to={`/historial/${last.id}`} className="flex items-center gap-3 px-4 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] text-mute">Último entrenamiento · {relativeDay(last.startedAt)}</span>
                <span className="block truncate font-medium">{last.name}</span>
              </span>
              <span className="text-right text-[13px] text-sub tnum">
                {sessionSetCount(last)} series
                <br />
                {showVolume(sessionVolume(last), unit)}
              </span>
              <ChevronRight size={18} className="text-mute" />
            </Link>
          )}
          {next && (
            <Link to={`/rutinas/${next.t.id}`} className="flex items-center gap-3 px-4 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] text-mute">Próximo · {next.inDays === 1 ? 'Mañana' : DAY_NAMES[next.day]}</span>
                <span className="block truncate font-medium">{next.t.name}</span>
              </span>
              <span className="text-[13px] text-sub">{next.t.items.length} ejercicios</span>
              <ChevronRight size={18} className="text-mute" />
            </Link>
          )}
        </div>
      </Section>

      {recentPRs.length > 0 && (
        <Section title="Récords recientes" action={<Link to="/progreso" className="text-sm text-accent">Ver todo</Link>}>
          <div className="card divide-hair">
            {recentPRs.map((p, i) => (
              <Link key={i} to={`/ejercicio/${p.exId}`} className="flex items-center gap-3 px-4 py-3">
                <Trophy size={17} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{exercises.get(p.exId)?.name}</span>
                  <span className="block text-[12px] text-mute">
                    {p.label} · {relativeDay(p.t)}
                  </span>
                </span>
                <span className="font-semibold tnum">
                  {wu(p.w)} × {p.r}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {needsBackup && (
        <Link to="/ajustes" className="card mb-7 flex items-center gap-3 p-4">
          <CloudOff size={20} className="shrink-0 text-warn" />
          <span className="flex-1 text-sm">
            <b className="block font-semibold">Haz una copia de seguridad</b>
            <span className="text-sub">{settings.lastExportAt ? `Última copia ${relativeDay(settings.lastExportAt).toLowerCase()}.` : 'Aún no has exportado tus datos.'} Tus datos viven solo en este teléfono.</span>
          </span>
          <ArrowUpRight size={18} className="text-mute" />
        </Link>
      )}

      <Sheet open={pick} onClose={() => setPick(false)} title="Elegir entrenamiento">
        <div className="card divide-hair">
          {templates.map((t) => (
            <button key={t.id} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-raised" onClick={() => { setPick(false); start(t); }}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-raised text-[13px] font-bold text-sub">{t.short}</span>
              <span className="flex-1">
                <span className="block font-medium">{t.name}</span>
                <span className="block text-[13px] text-sub">
                  {WEEK_ORDER.filter((d) => settings.weekPlan[d] === t.id).map((d) => DAY_NAMES[d]).join(', ') || 'Sin día asignado'}
                </span>
              </span>
              <Play size={16} className="text-mute" />
            </button>
          ))}
          <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-raised" onClick={() => { setPick(false); start(null); }}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-raised text-lg text-sub">+</span>
            <span className="flex-1">
              <span className="block font-medium">Entrenamiento libre</span>
              <span className="block text-[13px] text-sub">Empieza vacío y añade ejercicios</span>
            </span>
          </button>
        </div>
      </Sheet>
    </Page>
  );
}

