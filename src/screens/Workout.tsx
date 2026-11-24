import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Check, ChevronDown, Clock, Info, MoreHorizontal, Pause, Play, Plus, Repeat, StickyNote, Trash2, Trophy, TrendingDown, TrendingUp, ArrowUp, ArrowDown, CheckCheck, Image as ImageIcon,
} from 'lucide-react';
import { db } from '../db/db';
import type { Exercise, Session, SessionExercise } from '../db/types';
import { useActive, useExercises, useNow, useSessions, useSettings, useUnit } from '../lib/hooks';
import { completeSet, finishSession, mutate, setPaused, buildEntry } from '../lib/workout';
import { fmtSets, lastPerformance, sessionDuration, sessionSetCount, sessionVolume, suggestion, PR_LABEL, bestsFor, e1rm, MUSCLE_LABEL } from '../lib/calc';
import { formatDuration, formatMinutes, relativeDay } from '../lib/dates';
import { fromUnit, roundDisplay, showVolume, toUnit } from '../lib/units';
import { NumInput, Sheet, useConfirm, useToast } from '../components/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import { beep, buzz, keepScreenOn, unlockAudio } from '../lib/feedback';

export default function Workout() {
  const active = useActive();
  const sessions = useSessions();
  const nav = useNavigate();
  const [summary, setSummary] = useState<string | null>(null);

  // useLiveQuery devuelve undefined mientras carga y también si no hay sesión.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    db.sessions.where('status').equals('activa').count().then(() => setLoaded(true));
  }, []);

  if (summary) return <Summary id={summary} onClose={() => nav(`/historial/${summary}`, { replace: true })} />;
  if (!active || !sessions) {
    if (loaded && !active)
      return (
        <div className="grid min-h-screen place-items-center p-8 text-center safe-top">
          <div>
            <p className="text-sub">No hay ningún entrenamiento en curso.</p>
            <button className="btn-primary mt-4" onClick={() => nav('/', { replace: true })}>
              Ir al inicio
            </button>
          </div>
        </div>
      );
    return null;
  }
  return <ActiveWorkout session={active} sessions={sessions} onFinished={setSummary} />;
}

function ActiveWorkout({ session, sessions, onFinished }: { session: Session; sessions: Session[]; onFinished: (id: string) => void }) {
  const settings = useSettings();
  const exercises = useExercises();
  const nav = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const now = useNow(500);
  const [picker, setPicker] = useState<null | { mode: 'add' } | { mode: 'swap'; key: string }>(null);

  useEffect(() => keepScreenOn(settings.keepAwake), [settings.keepAwake]);

  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneCount = session.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  // Respuesta inmediata en pantalla; la base de datos se actualiza justo después.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const savedPaused = !!session.pausedAt;
  const paused = optimistic ?? savedPaused;
  useEffect(() => {
    if (optimistic != null && optimistic === savedPaused) setOptimistic(null);
  }, [optimistic, savedPaused]);
  const togglePause = async () => {
    const want = !paused;
    setOptimistic(want);
    if (settings.vibrate) buzz(20);
    try {
      await setPaused(session.id, want);
    } catch (e) {
      setOptimistic(null);
      toast(`No se pudo ${want ? 'pausar' : 'reanudar'}: ${(e as Error)?.message ?? e}`);
    }
  };
  const shownNow = paused && !savedPaused ? Date.now() : now;

  const finish = async () => {
    const pending = session.exercises.reduce((a, e) => a + e.sets.filter((s) => !s.done).length, 0);
    if (doneCount === 0) {
      const ok = await confirm({ title: 'No has validado ninguna serie', body: '¿Quieres descartar este entrenamiento?', confirm: 'Descartar', danger: true });
      if (ok) {
        await db.sessions.delete(session.id);
        nav('/', { replace: true });
      }
      return;
    }
    const ok = await confirm({
      title: 'Terminar entrenamiento',
      body: pending ? `Quedan ${pending} series sin validar: no se guardarán en el historial.` : 'Se guardará en tu historial.',
      confirm: 'Terminar',
    });
    if (!ok) return;
    onFinished(session.id);
    await finishSession(session.id);
  };

  const discard = async () => {
    const ok = await confirm({ title: 'Descartar entrenamiento', body: 'Se borrarán todas las series de esta sesión. No se puede deshacer.', confirm: 'Descartar', danger: true });
    if (ok) {
      await db.sessions.delete(session.id);
      nav('/', { replace: true });
    }
  };

  const onPick = async (ex: Exercise) => {
    const p = picker;
    setPicker(null);
    if (!p) return;
    const item = { exerciseId: ex.id, sets: 3, repMin: 8, repMax: 12, startLabel: '', restSec: ex.compound ? settings.restCompound : settings.restIsolation };
    await mutate(session.id, (s) => {
      if (p.mode === 'add') {
        s.exercises.push(buildEntry(item, ex, sessions, settings));
      } else {
        const i = s.exercises.findIndex((e) => e.key === p.key);
        if (i < 0) return;
        const old = s.exercises[i];
        const entry = buildEntry({ ...item, sets: old.target.sets, repMin: old.target.repMin, repMax: old.target.repMax, restSec: old.target.restSec }, ex, sessions, settings);
        s.exercises[i] = { ...entry, target: { ...old.target } };
      }
    });
    if (p.mode === 'swap') toast(`Cambiado por ${ex.name}`);
  };

  return (
    <div className="min-h-screen pb-56">
      {/* ── Cabecera fija */}
      <header className="sticky top-0 z-30 safe-top" style={{ background: 'rgb(var(--bg) / 0.9)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <div className="flex h-14 items-center gap-1 px-2">
          <button className="btn-icon" aria-label="Minimizar" onClick={() => nav('/')}>
            <ChevronDown size={24} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[15px] font-semibold leading-tight">{session.name}</div>
            <div className={`text-[13px] tnum ${paused ? 'text-warn' : 'text-sub'}`}>{paused ? 'En pausa · ' : ''}{formatDuration(sessionDuration(session, shownNow))}</div>
          </div>
          <button
            className={`btn mr-1 h-9 rounded-full px-3 text-sm ${paused ? 'bg-warn text-black' : 'bg-raised text-ink'}`}
            aria-label={paused ? 'Reanudar' : 'Pausar'}
            onClick={togglePause}
          >
            {paused ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}
            {paused ? 'Seguir' : 'Pausa'}
          </button>
          <button className="btn h-9 rounded-full bg-accent px-4 text-sm text-onaccent" onClick={finish}>
            Terminar
          </button>
        </div>
        <div className="h-[3px] bg-raised">
          <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${totalSets ? (doneCount / totalSets) * 100 : 0}%` }} />
        </div>
      </header>

      {paused && (
        <div className="fixed inset-0 z-[45] flex flex-col items-center justify-center px-8 text-center anim-fade" style={{ background: 'rgb(var(--bg) / 0.94)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="eyebrow text-warn">Entrenamiento en pausa</div>
          <div className="mt-3 text-[56px] font-semibold leading-none tracking-tight tnum">{formatDuration(sessionDuration(session, shownNow))}</div>
          <p className="mt-3 max-w-xs text-sm text-sub">El tiempo y el descanso están detenidos. Todo lo que apuntaste está guardado.</p>
          <button className="btn-primary mt-8 w-full max-w-xs" onClick={togglePause}>
            <Play size={18} fill="currentColor" /> Reanudar
          </button>
          <button className="btn-ghost mt-2" onClick={() => nav('/')}>
            Salir (la sesión se queda guardada)
          </button>
        </div>
      )}

      <div className="px-4 pt-4 text-[13px] text-sub tnum flex justify-between">
        <span>
          {doneCount} de {totalSets} series
        </span>
        <span>{showVolume(sessionVolume(session), settings.unit)}</span>
      </div>

      <div className="mt-3 space-y-4 px-4">
        {session.exercises.map((e, i) => {
          const ex = exercises.get(e.exerciseId);
          if (!ex) return null;
          return (
            <ExerciseCard
              key={e.key}
              session={session}
              entry={e}
              ex={ex}
              index={i}
              count={session.exercises.length}
              sessions={sessions}
              onSwap={() => setPicker({ mode: 'swap', key: e.key })}
            />
          );
        })}
      </div>

      <div className="mt-6 space-y-2 px-4">
        <button className="btn-secondary w-full" onClick={() => setPicker({ mode: 'add' })}>
          <Plus size={18} /> Añadir ejercicio
        </button>
        <button className="btn-ghost w-full text-bad" onClick={discard}>
          Descartar entrenamiento
        </button>
      </div>

      <RestTimer session={session} now={now} />
      <ExercisePicker open={!!picker} onClose={() => setPicker(null)} onPick={onPick} title={picker?.mode === 'swap' ? 'Cambiar ejercicio' : 'Añadir ejercicio'} />
    </div>
  );
}

function ExerciseCard({ session, entry, ex, index, count, sessions, onSwap }: { session: Session; entry: SessionExercise; ex: Exercise; index: number; count: number; sessions: Session[]; onSwap: () => void }) {
  const settings = useSettings();
  const { unit, wu, w } = useUnit();
  const toast = useToast();
  const confirm = useConfirm();
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState(false);
  const [restEdit, setRestEdit] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!entry.note);
  const [collapsed, setCollapsed] = useState(!!entry.finished);
  const exercisesMap = useExercises();

  const last = useMemo(() => lastPerformance(ex.id, sessions, session.id), [ex.id, sessions, session.id]);
  const sug = last ? suggestion(last.entry, ex) : null;
  const lastSets = last?.entry.sets.filter((s) => s.done && s.weight != null) ?? [];

  const t = entry.target;
  const repsText = t.repsLabel ?? (t.repMax <= 0 ? '' : t.repMin === t.repMax ? `${t.sets} × ${t.repMax}` : `${t.sets} × ${t.repMin}–${t.repMax}`);
  const allDone = entry.sets.length > 0 && entry.sets.every((s) => s.done);

  const setField = (i: number, field: 'weight' | 'reps', value: number | null) =>
    mutate(session.id, (s) => {
      const e = s.exercises.find((x) => x.key === entry.key);
      if (!e) return;
      const old = e.sets[i][field];
      e.sets[i][field] = value;
      // Al cambiar el peso, arrastra el cambio a las series siguientes aún no hechas que tenían el mismo peso.
      if (field === 'weight') for (let j = i + 1; j < e.sets.length; j++) if (!e.sets[j].done && e.sets[j].weight === old) e.sets[j].weight = value;
    });

  const check = async (i: number) => {
    unlockAudio();
    const set = entry.sets[i];
    if (set.done) {
      await mutate(session.id, (s) => {
        const e = s.exercises.find((x) => x.key === entry.key);
        if (e) {
          e.sets[i].done = false;
          e.sets[i].pr = [];
        }
      });
      return;
    }
    let weight = set.weight;
    let reps = set.reps;
    if (weight == null) {
      if (ex.bodyweight) weight = 0;
      else return toast('Indica el peso');
    }
    if (reps == null) {
      const prevHere = [...entry.sets.slice(0, i)].reverse().find((s) => s.done && s.reps != null)?.reps;
      const fallback = lastSets[i]?.reps ?? prevHere ?? null;
      if (fallback == null) return toast('Indica las repeticiones');
      reps = fallback;
    }
    await mutate(session.id, (s) => {
      const e = s.exercises.find((x) => x.key === entry.key);
      if (!e) return;
      e.sets[i].weight = weight;
      e.sets[i].reps = reps;
    });
    const res = await completeSet(session.id, entry.key, i, settings);
    if (settings.vibrate) buzz(30);
    if (res.prs?.length) {
      toast(
        <span className="flex items-center gap-2">
          <Trophy size={16} /> {PR_LABEL[res.prs[0]]} · {wu(weight!)} × {reps}
        </span>,
        'accent',
      );
    }
    // ¿Última serie? → ejercicio terminado y siguiente.
    if (entry.sets.every((s, j) => j === i || s.done)) {
      await mutate(session.id, (s) => {
        const e = s.exercises.find((x) => x.key === entry.key);
        if (e) e.finished = true;
      });
      setTimeout(() => setCollapsed(true), 600);
    }
  };

  const update = (fn: (e: SessionExercise, s: Session) => void) =>
    mutate(session.id, (s) => {
      const e = s.exercises.find((x) => x.key === entry.key);
      if (e) fn(e, s);
    });

  const addSet = () =>
    update((e) => {
      const prev = e.sets[e.sets.length - 1];
      e.sets.push({ weight: prev?.weight ?? null, reps: ex.freeform ? 1 : null, done: false });
      e.finished = false;
    }).then(() => setCollapsed(false));

  const removeSet = async (i: number) => {
    if (entry.sets[i].done && !(await confirm({ title: `Eliminar serie ${i + 1}`, body: 'Esta serie ya estaba validada.', confirm: 'Eliminar', danger: true }))) return;
    update((e) => {
      e.sets.splice(i, 1);
    });
  };

  const bests = useMemo(() => bestsFor(ex.id, sessions, session.id), [ex.id, sessions, session.id]);
  const templateItemAlts = useAlternatives(session.templateId, ex.id);
  const itemTip = useItemTip(session.templateId, ex.id);

  if (collapsed && allDone) {
    const vol = entry.sets.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0);
    return (
      <button className="card flex w-full items-center gap-3 p-4 text-left anim-fade" onClick={() => setCollapsed(false)}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-onaccent">
          <Check size={17} strokeWidth={3} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{ex.name}</span>
          <span className="block truncate text-[13px] text-sub tnum">{fmtSets(entry.sets, w)}</span>
        </span>
        <span className="text-[13px] text-sub tnum">{showVolume(vol, unit)}</span>
      </button>
    );
  }

  return (
    <article className="card overflow-hidden">
      <div className="flex items-start gap-2 p-4 pb-2">
        <button className="min-w-0 flex-1 text-left" onClick={() => setInfo(true)}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mute tnum">
            {index + 1}/{count} · {ex.muscles.map((m) => MUSCLE_LABEL[m]).slice(0, 2).join(' · ')}
          </div>
          <h3 className="mt-0.5 text-[17px] font-semibold leading-snug text-ink">{ex.name}</h3>
        </button>
        <button className="btn-icon -mr-2 -mt-1" aria-label="Opciones del ejercicio" onClick={() => setMenu(true)}>
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 text-[13px]">
        {repsText && <span className="chip tnum">{repsText}</span>}
        <button className="chip tnum gap-1" onClick={() => setRestEdit(true)}>
          <Clock size={12} /> {t.restSec ? formatDuration(t.restSec * 1000) : 'Sin descanso'}
        </button>
        {ex.equipment === 'mancuerna' && <span className="chip">{unit} por mancuerna</span>}
        <button className="chip gap-1" onClick={() => setInfo(true)}>
          <Info size={12} /> Técnica
        </button>
      </div>

      {ex.caution && (
        <div className="mx-4 mt-3 flex gap-2 rounded-xl p-3 text-[13px]" style={{ background: 'rgb(var(--warn) / 0.1)' }}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" />
          <span className="flex-1">
            {ex.caution}
            {templateItemAlts.length > 0 && (
              <button className="ml-1 font-semibold text-warn underline underline-offset-2" onClick={onSwap}>
                Cambiar
              </button>
            )}
          </span>
        </div>
      )}

      {last && (
        <div className="mx-4 mt-3 rounded-xl bg-raised/60 px-3 py-2.5 text-[13px]">
          <div className="flex justify-between text-mute">
            <span>Última vez · {relativeDay(last.session.startedAt)}</span>
            {bests.maxE1rm > 0 && <span className="tnum">1RM est. {wu(bests.maxE1rm)}</span>}
          </div>
          <div className="mt-0.5 font-medium tnum text-ink/90">{fmtSets(last.entry.sets, w)}</div>
          {last.entry.note && <div className="mt-1 text-sub">“{last.entry.note}”</div>}
        </div>
      )}

      {sug && sug.kind !== 'mantener' && (
        <div className={`mx-4 mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] ${sug.kind === 'subir' ? 'text-accent' : 'text-warn'}`} style={{ background: sug.kind === 'subir' ? 'rgb(var(--accent) / 0.1)' : 'rgb(var(--warn) / 0.1)' }}>
          {sug.kind === 'subir' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span className="flex-1">
            <b>{sug.kind === 'subir' ? `Sube a ${wu(sug.weightKg)}` : `Baja a ${wu(sug.weightKg)}`}</b>
            <span className="text-sub"> · {sug.reason}</span>
          </span>
        </div>
      )}

      {/* ── Tabla de series */}
      <div className="mt-3 px-2">
        <div className="grid grid-cols-[34px_1fr_76px_64px_48px] items-center gap-1.5 px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">
          <span className="text-center">Serie</span>
          <span>Anterior</span>
          <span className="text-center">{unit}</span>
          <span className="text-center">{ex.freeform ? 'Subidas' : 'Reps'}</span>
          <span />
        </div>
        {entry.sets.map((s, i) => {
          const prev = lastSets[i];
          const repPh = prev?.reps != null ? String(prev.reps) : t.repMax > 0 ? (t.repMin === t.repMax ? String(t.repMax) : `${t.repMin}-${t.repMax}`) : '';
          const est = s.done && s.weight && s.reps ? e1rm(s.weight, s.reps) : null;
          return (
            <div key={i} className={`grid grid-cols-[34px_1fr_76px_64px_48px] items-center gap-1.5 rounded-xl px-2 py-1 transition-colors ${s.done ? 'bg-accent/[0.08]' : ''}`}>
              <button className="h-10 rounded-lg text-center text-[15px] font-semibold text-sub tnum active:bg-raised" aria-label={`Eliminar serie ${i + 1}`} onClick={() => removeSet(i)}>
                {s.pr?.length ? <Trophy size={15} className="mx-auto text-accent" /> : i + 1}
              </button>
              <span className="truncate text-[13px] text-mute tnum">
                {prev ? `${w(prev.weight)} × ${prev.reps ?? '?'}` : '—'}
                {est && s.pr?.length ? <span className="block text-[10px] text-accent">{PR_LABEL[s.pr[0]]}</span> : null}
              </span>
              <NumInput
                ariaLabel={`Peso serie ${i + 1}`}
                value={s.weight == null ? null : roundDisplay(toUnit(s.weight, unit), unit)}
                placeholder={prev ? w(prev.weight) : ex.bodyweight ? '0' : unit}
                onChange={(v) => setField(i, 'weight', v == null ? null : fromUnit(v, unit))}
                className={s.done ? '!bg-transparent' : ''}
              />
              <NumInput
                ariaLabel={`Repeticiones serie ${i + 1}`}
                decimal={false}
                value={s.reps}
                placeholder={repPh}
                onChange={(v) => setField(i, 'reps', v)}
                className={s.done ? '!bg-transparent' : ''}
              />
              <button
                aria-label={s.done ? `Desmarcar serie ${i + 1}` : `Validar serie ${i + 1}`}
                onClick={() => check(i)}
                className={`grid h-11 w-11 place-items-center justify-self-end rounded-xl transition-all active:scale-90 ${s.done ? 'bg-accent text-onaccent' : 'bg-raised text-mute'}`}
              >
                <Check size={20} strokeWidth={3} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1 px-2 pb-2 pt-1">
        <button className="btn-ghost flex-1" onClick={addSet}>
          <Plus size={16} /> Serie
        </button>
        <button className="btn-ghost flex-1" onClick={() => setNoteOpen((v) => !v)}>
          <StickyNote size={15} /> Nota
        </button>
        {allDone ? (
          <button className="btn-ghost flex-1" onClick={() => setCollapsed(true)}>
            <CheckCheck size={16} /> Plegar
          </button>
        ) : (
          <button
            className="btn-ghost flex-1"
            onClick={() =>
              update((e) => {
                e.finished = true;
              }).then(() => {
                setCollapsed(true);
              })
            }
            disabled={!entry.sets.some((s) => s.done)}
          >
            <CheckCheck size={16} /> Hecho
          </button>
        )}
      </div>
      {noteOpen && (
        <div className="px-4 pb-4">
          <NoteField value={entry.note ?? ''} onSave={(v) => update((e) => void (e.note = v || undefined))} />
        </div>
      )}

      {/* ── Menú */}
      <Sheet open={menu} onClose={() => setMenu(false)} title={ex.name}>
        <div className="card divide-hair">
          <MenuItem icon={<Repeat size={18} />} label={templateItemAlts.length ? `Cambiar ejercicio (alternativa: ${templateItemAlts.map((a) => exercisesMap.get(a)?.name).join(', ')})` : 'Cambiar ejercicio'} onClick={() => { setMenu(false); onSwap(); }} />
          <MenuItem icon={<ArrowUp size={18} />} label="Subir en la lista" disabled={index === 0} onClick={() => { setMenu(false); mutate(session.id, (s) => { const [x] = s.exercises.splice(index, 1); s.exercises.splice(index - 1, 0, x); }); }} />
          <MenuItem icon={<ArrowDown size={18} />} label="Bajar en la lista" disabled={index === count - 1} onClick={() => { setMenu(false); mutate(session.id, (s) => { const [x] = s.exercises.splice(index, 1); s.exercises.splice(index + 1, 0, x); }); }} />
          <MenuItem icon={<Clock size={18} />} label="Cambiar descanso" onClick={() => { setMenu(false); setRestEdit(true); }} />
          <MenuItem
            icon={<Trash2 size={18} />}
            danger
            label="Quitar de esta sesión"
            onClick={async () => {
              setMenu(false);
              if (entry.sets.some((s) => s.done) && !(await confirm({ title: 'Quitar ejercicio', body: 'Se perderán sus series de hoy.', confirm: 'Quitar', danger: true }))) return;
              mutate(session.id, (s) => {
                s.exercises = s.exercises.filter((x) => x.key !== entry.key);
              });
            }}
          />
        </div>
        <p className="mt-3 px-1 text-xs text-mute">Para eliminar una serie, toca su número. Los cambios solo afectan a esta sesión: tu rutina no cambia.</p>
      </Sheet>

      <Sheet open={info} onClose={() => setInfo(false)} title={ex.name}>
        <ExerciseInfo ex={ex} tip={itemTip} />
      </Sheet>

      <Sheet open={restEdit} onClose={() => setRestEdit(false)} title="Descanso entre series">
        <div className="grid grid-cols-3 gap-2">
          {[0, 30, 45, 60, 75, 90, 120, 150, 180, 240].map((sec) => (
            <button
              key={sec}
              className={`btn h-12 tnum ${t.restSec === sec ? 'bg-accent text-onaccent' : 'bg-raised'}`}
              onClick={() => {
                update((e) => void (e.target.restSec = sec));
                setRestEdit(false);
              }}
            >
              {sec ? formatDuration(sec * 1000) : 'Ninguno'}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-mute">Regla 5: 2–3 min en los ejercicios grandes, 1–1,5 min en los chicos. Solo cambia esta sesión; para cambiarlo siempre, edita la rutina.</p>
      </Sheet>
    </article>
  );
}

function useAlternatives(templateId: string | null, exerciseId: string) {
  const [alts, setAlts] = useState<string[]>([]);
  useEffect(() => {
    if (!templateId) return;
    db.templates.get(templateId).then((t) => {
      const item = t?.items.find((i) => i.exerciseId === exerciseId || i.alternatives?.includes(exerciseId));
      if (!item) return;
      setAlts([item.exerciseId, ...(item.alternatives ?? [])].filter((x) => x !== exerciseId));
    });
  }, [templateId, exerciseId]);
  return alts;
}

function useItemTip(templateId: string | null, exerciseId: string) {
  const [tip, setTip] = useState<string | undefined>();
  useEffect(() => {
    if (!templateId) return;
    db.templates.get(templateId).then((t) => setTip(t?.items.find((i) => i.exerciseId === exerciseId)?.tip));
  }, [templateId, exerciseId]);
  return tip;
}

export function ExerciseInfo({ ex, tip }: { ex: Exercise; tip?: string }) {
  return (
    <div className="space-y-4">
      {ex.photo ? (
        <img src={ex.photo} alt={ex.name} className="aspect-[4/3] w-full rounded-2xl object-cover" />
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-raised p-4 text-sm text-sub">
          <ImageIcon size={20} className="shrink-0" />
          Puedes añadir una foto de la máquina de tu gym desde la ficha del ejercicio.
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {ex.muscles.map((m, i) => (
          <span key={m} className={`chip ${i === 0 ? '!bg-accent/15 !text-accent' : ''}`}>
            {MUSCLE_LABEL[m]}
          </span>
        ))}
      </div>
      <div>
        <div className="eyebrow mb-1.5">Cómo hacerlo bien</div>
        <p className="text-[15px] leading-relaxed">{tip ?? ex.tip}</p>
        {tip && tip !== ex.tip && ex.tip && <p className="mt-2 text-[14px] leading-relaxed text-sub">{ex.tip}</p>}
      </div>
      {ex.caution && (
        <div className="flex gap-2 rounded-xl p-3 text-[14px]" style={{ background: 'rgb(var(--warn) / 0.1)' }}>
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-warn" /> {ex.caution}
        </div>
      )}
      <p className="text-[13px] text-sub">Baja el peso despacio, en 2–3 segundos. Deja 1–2 reps en reserva.</p>
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] active:bg-raised disabled:opacity-35 ${danger ? 'text-bad' : ''}`}>
      <span className={danger ? '' : 'text-sub'}>{icon}</span>
      {label}
    </button>
  );
}

function NoteField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const t = useRef<number>();
  return (
    <textarea
      className="field h-20 py-3 text-[15px]"
      placeholder="Nota (asiento en 4, agarre, sensaciones…)"
      value={v}
      onChange={(e) => {
        setV(e.target.value);
        clearTimeout(t.current);
        const val = e.target.value;
        t.current = window.setTimeout(() => onSave(val.trim()), 400);
      }}
      onBlur={() => onSave(v.trim())}
    />
  );
}

function RestTimer({ session, now }: { session: Session; now: number }) {
  const settings = useSettings();
  const toast = useToast();
  const firedFor = useRef<number | null>(null);
  const ends = session.restEndsAt;
  const total = session.restTotal ?? 0;
  const ref = session.pausedAt ?? now;
  const left = ends ? Math.ceil((ends - ref) / 1000) : 0;

  useEffect(() => {
    if (!ends || session.pausedAt) return;
    if (left <= 0 && firedFor.current !== ends) {
      firedFor.current = ends;
      // Solo avisa si acaba de terminar (no al volver a la app mucho después).
      if (now - ends < 5000) {
        if (settings.sound) beep();
        if (settings.vibrate) buzz();
        toast('Descanso terminado · ¡a por la siguiente!', 'accent');
      }
      mutate(session.id, (s) => {
        if (s.restEndsAt === ends) {
          s.restEndsAt = undefined;
          s.restTotal = undefined;
        }
      });
    }
  }, [left, ends, now, session.id, session.pausedAt, settings.sound, settings.vibrate, toast]);

  if (!ends || left <= 0) return null;
  const adjust = (d: number) =>
    mutate(session.id, (s) => {
      if (!s.restEndsAt) return;
      s.restEndsAt = Math.max(Date.now() + 1000, s.restEndsAt + d * 1000);
      s.restTotal = Math.max(1, (s.restTotal ?? 0) + d);
    });
  const skip = () =>
    mutate(session.id, (s) => {
      s.restEndsAt = undefined;
      s.restTotal = undefined;
    });
  const pct = total ? Math.min(1, left / total) : 0;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 safe-bottom anim-sheet">
      <div className="mx-auto max-w-lg px-3 pb-3">
        <div className="overflow-hidden rounded-3xl bg-raised" style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--line) / 0.1), 0 -8px 40px rgb(0 0 0 / 0.45)' }}>
          <div className="h-1 bg-surface">
            <div className="h-full bg-accent transition-[width] duration-500 ease-linear" style={{ width: `${pct * 100}%` }} />
          </div>
          <div className="flex items-center gap-2 p-3">
            <button className="btn h-12 w-16 bg-surface text-[15px] tnum" onClick={() => adjust(-15)}>
              −15
            </button>
            <div className="flex-1 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mute">Descanso{session.pausedAt ? ' · pausa' : ''}</div>
              <div className="text-[34px] font-semibold leading-none tnum tracking-tight">{formatDuration(left * 1000)}</div>
            </div>
            <button className="btn h-12 w-16 bg-surface text-[15px] tnum" onClick={() => adjust(15)}>
              +15
            </button>
            <button className="btn h-12 bg-accent px-4 text-[15px] text-onaccent" onClick={skip}>
              Saltar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Summary({ id, onClose }: { id: string; onClose: () => void }) {
  const sessions = useSessions();
  const exercises = useExercises();
  const { unit, wu } = useUnit();
  const s = sessions?.find((x) => x.id === id);
  if (!s || !sessions) return null;
  const prev = sessions
    .filter((x) => x.status === 'terminada' && x.id !== s.id && x.templateId && x.templateId === s.templateId && x.startedAt < s.startedAt)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  const vol = sessionVolume(s);
  const pvol = prev ? sessionVolume(prev) : 0;
  const prs = s.exercises.flatMap((e) => e.sets.filter((x) => x.pr?.length).map((x) => ({ e, x })));
  return (
    <div className="min-h-screen px-5 pb-10 safe-top anim-rise">
      <div className="pt-12 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-onaccent anim-pop">
          <Check size={32} strokeWidth={3} />
        </div>
        <h1 className="mt-5 text-[28px] font-bold tracking-tight">Entrenamiento guardado</h1>
        <p className="mt-1 text-sub">{s.name}</p>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-3 text-center">
        {[
          ['Duración', formatMinutes(sessionDuration(s))],
          ['Series', String(sessionSetCount(s))],
          ['Volumen', showVolume(vol, unit)],
        ].map(([k, v]) => (
          <div key={k} className="card p-3">
            <div className="eyebrow">{k}</div>
            <div className="mt-1 text-lg font-semibold tnum">{v}</div>
          </div>
        ))}
      </div>
      {prev && pvol > 0 && (
        <p className="mt-4 text-center text-sm text-sub">
          {vol >= pvol ? '+' : '−'}
          {Math.abs(Math.round(((vol - pvol) / pvol) * 100))} % de volumen respecto a la última {s.name}
        </p>
      )}
      {prs.length > 0 && (
        <div className="mt-8">
          <div className="eyebrow mb-2 px-1">Nuevos récords</div>
          <div className="card divide-hair">
            {prs.map(({ e, x }, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Trophy size={17} className="text-accent" />
                <span className="flex-1">
                  <span className="block text-[15px]">{exercises.get(e.exerciseId)?.name}</span>
                  <span className="block text-xs text-mute">{x.pr!.map((p) => PR_LABEL[p]).join(' · ')}</span>
                </span>
                <span className="font-semibold tnum">
                  {wu(x.weight)} × {x.reps}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button className="btn-primary mt-10 w-full" onClick={onClose}>
        Ver detalle
      </button>
    </div>
  );
}
