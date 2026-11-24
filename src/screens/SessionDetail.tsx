import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, GitCompare, Pencil, Plus, Trash2, Trophy, X } from 'lucide-react';
import { db } from '../db/db';
import type { Session } from '../db/types';
import { Page, Section, NumInput, useConfirm, useToast } from '../components/ui';
import { useExercises, useSessions, useUnit } from '../lib/hooks';
import { e1rm, exVolume, sessionDuration, sessionSetCount, sessionVolume, PR_LABEL } from '../lib/calc';
import { formatLong, formatMinutes, formatTime, dayKey } from '../lib/dates';
import { fromUnit, roundDisplay, showVolume, toUnit } from '../lib/units';

export default function SessionDetail() {
  const { id } = useParams();
  const s = useLiveQuery(() => db.sessions.get(id!), [id]);
  const sessions = useSessions() ?? [];
  const exercises = useExercises();
  const { unit, w, wu } = useUnit();
  const nav = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [draft, setDraft] = useState<Session | null>(null);

  if (!s) return <Page back title=" ">{null}</Page>;
  const view = draft ?? s;
  const editing = !!draft;
  const prev = sessions
    .filter((x) => x.status === 'terminada' && x.id !== s.id && s.templateId && x.templateId === s.templateId && x.startedAt < s.startedAt)
    .sort((a, b) => b.startedAt - a.startedAt)[0];

  const edit = (fn: (d: Session) => void) =>
    setDraft((d) => {
      const c = structuredClone(d!);
      fn(c);
      return c;
    });

  const save = async () => {
    if (!draft) return;
    draft.exercises = draft.exercises.map((e) => ({ ...e, sets: e.sets.filter((x) => x.weight != null || x.reps != null) })).filter((e) => e.sets.length);
    await db.sessions.put(draft);
    setDraft(null);
    toast('Cambios guardados');
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Eliminar entrenamiento', body: 'Se borrará del historial y de las estadísticas. No se puede deshacer.', confirm: 'Eliminar', danger: true }))) return;
    await db.sessions.delete(s.id);
    nav('/historial', { replace: true });
  };

  return (
    <Page
      back
      subtitle={`${formatLong(view.startedAt)} · ${formatTime(view.startedAt)}`}
      title={view.name}
      actions={
        editing ? (
          <>
            <button className="btn-icon" aria-label="Cancelar" onClick={() => setDraft(null)}>
              <X size={20} />
            </button>
            <button className="btn h-9 rounded-full bg-accent px-4 text-sm text-onaccent" onClick={save}>
              <Check size={16} /> Guardar
            </button>
          </>
        ) : (
          <button className="btn-ghost text-accent" onClick={() => setDraft(structuredClone(s))}>
            <Pencil size={16} /> Editar
          </button>
        )
      }
    >
      <div className="mb-6 grid grid-cols-3 gap-2 text-center">
        {[
          ['Duración', s.imported ? '—' : formatMinutes(sessionDuration(view))],
          ['Series', String(sessionSetCount(view))],
          ['Volumen', showVolume(sessionVolume(view), unit)],
        ].map(([k, v]) => (
          <div key={k} className="card py-3">
            <div className="text-lg font-semibold tnum">{v}</div>
            <div className="text-[11px] uppercase tracking-wide text-mute">{k}</div>
          </div>
        ))}
      </div>

      {editing && (
        <label className="card mb-5 block p-4">
          <span className="eyebrow">Fecha</span>
          <input
            type="date"
            className="field mt-1.5"
            value={dayKey(view.startedAt)}
            onChange={(e) => {
              if (!e.target.value) return;
              const [y, m, d] = e.target.value.split('-').map(Number);
              edit((x) => {
                const dur = (x.endedAt ?? x.startedAt) - x.startedAt;
                const st = new Date(x.startedAt);
                st.setFullYear(y, m - 1, d);
                x.startedAt = st.getTime();
                x.endedAt = x.startedAt + dur;
              });
            }}
          />
        </label>
      )}

      {view.note && !editing && <p className="mb-5 rounded-xl bg-raised/60 p-3 text-[13px] text-sub">{view.note}</p>}

      {prev && !editing && (
        <Link to={`/comparar?a=${prev.id}&b=${s.id}`} className="card mb-6 flex items-center gap-3 p-4">
          <GitCompare size={18} className="text-accent" />
          <span className="flex-1 text-[15px]">Comparar con la sesión anterior</span>
          <span className="text-sm text-sub tnum">
            {(() => {
              const a = sessionVolume(prev);
              const b = sessionVolume(s);
              return a ? `${b >= a ? '+' : '−'}${Math.abs(Math.round(((b - a) / a) * 100))} %` : '';
            })()}
          </span>
        </Link>
      )}

      {view.exercises.map((e, ei) => {
        const ex = exercises.get(e.exerciseId);
        return (
          <Section key={e.key} title={undefined}>
            <div className="card overflow-hidden">
              <div className="flex items-start justify-between gap-2 p-4 pb-2">
                <Link to={`/ejercicio/${e.exerciseId}`} className="min-w-0">
                  <div className="text-[16px] font-semibold leading-snug">{ex?.name ?? e.exerciseId}</div>
                  <div className="text-[13px] text-sub tnum">
                    {e.target.repMax > 0 && `Objetivo ${e.target.sets} × ${e.target.repMin === e.target.repMax ? e.target.repMax : `${e.target.repMin}–${e.target.repMax}`} · `}
                    {showVolume(exVolume(e), unit)}
                  </div>
                </Link>
                {editing && (
                  <button className="btn-icon -mr-2 text-bad" aria-label="Quitar ejercicio" onClick={() => edit((x) => void x.exercises.splice(ei, 1))}>
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              <div className="px-4 pb-3">
                {e.sets.map((st, si) =>
                  editing ? (
                    <div key={si} className="grid grid-cols-[28px_1fr_1fr_40px] items-center gap-2 py-1">
                      <span className="text-center text-sm text-mute tnum">{si + 1}</span>
                      <NumInput ariaLabel="Peso" value={st.weight == null ? null : roundDisplay(toUnit(st.weight, unit), unit)} placeholder={unit} onChange={(v) => edit((x) => void (x.exercises[ei].sets[si].weight = v == null ? null : fromUnit(v, unit)))} />
                      <NumInput ariaLabel="Reps" decimal={false} value={st.reps} placeholder="reps" onChange={(v) => edit((x) => void (x.exercises[ei].sets[si].reps = v))} />
                      <button className="btn-icon h-10 w-10 text-bad" aria-label="Eliminar serie" onClick={() => edit((x) => void x.exercises[ei].sets.splice(si, 1))}>
                        <X size={17} />
                      </button>
                    </div>
                  ) : (
                    <div key={si} className="flex items-center gap-3 border-t hairline py-2.5 first:border-t-0 text-[15px] tnum">
                      <span className="w-5 text-center text-sm text-mute">{si + 1}</span>
                      <span className="flex-1 font-medium">
                        {wu(st.weight)} <span className="text-mute">×</span> {st.reps ?? <span className="text-mute">?</span>}
                      </span>
                      {st.pr?.length ? (
                        <span className="inline-flex items-center gap-1 text-xs text-accent">
                          <Trophy size={12} /> {PR_LABEL[st.pr[0]]}
                        </span>
                      ) : st.weight && st.reps && e1rm(st.weight, st.reps) ? (
                        <span className="text-xs text-mute">1RM≈{w(e1rm(st.weight, st.reps))}</span>
                      ) : null}
                    </div>
                  ),
                )}
                {editing && (
                  <button className="btn-ghost w-full" onClick={() => edit((x) => void x.exercises[ei].sets.push({ weight: x.exercises[ei].sets[x.exercises[ei].sets.length - 1]?.weight ?? null, reps: null, done: true, doneAt: x.startedAt }))}>
                    <Plus size={16} /> Serie
                  </button>
                )}
                {e.note && !editing && <p className="mt-1 text-[13px] text-sub">“{e.note}”</p>}
                {editing && (
                  <input className="field mt-2 h-11 text-[15px]" placeholder="Nota" value={e.note ?? ''} onChange={(ev) => edit((x) => void (x.exercises[ei].note = ev.target.value || undefined))} />
                )}
              </div>
            </div>
          </Section>
        );
      })}

      {editing && (
        <button className="btn-ghost w-full text-bad" onClick={remove}>
          <Trash2 size={16} /> Eliminar entrenamiento
        </button>
      )}
    </Page>
  );
}
