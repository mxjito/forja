import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, ChevronRight, Clock, Pencil, Play, Plus, Trash2, Check, AlertTriangle } from 'lucide-react';
import { db } from '../db/db';
import type { Template, TemplateItem } from '../db/types';
import { Page, Section, Sheet, NumInput, useConfirm, useToast } from '../components/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import { useActive, useExercises, useSessions, useSettings, useUnit, saveSettings } from '../lib/hooks';
import { DAY_NAMES, WEEK_ORDER, formatDuration, relativeDay } from '../lib/dates';
import { fmtSets, lastPerformance, MUSCLE_LABEL } from '../lib/calc';
import { useStartWorkout, estimateMinutes } from './Home';

export default function TemplateDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const t = useLiveQuery(() => db.templates.get(id!), [id]);
  const exercises = useExercises();
  const sessions = useSessions() ?? [];
  const settings = useSettings();
  const active = useActive();
  const { w } = useUnit();
  const start = useStartWorkout();
  const nav = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const editing = params.get('editar') === '1';
  const [editItem, setEditItem] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);
  const [meta, setMeta] = useState(false);

  if (!t) return <Page back title=" ">{null}</Page>;

  const save = (fn: (x: Template) => void) => {
    const copy: Template = structuredClone(t);
    fn(copy);
    return db.templates.put(copy);
  };
  const days = WEEK_ORDER.filter((d) => settings.weekPlan[d] === t.id);
  const muscles = [...new Set(t.items.flatMap((i) => exercises.get(i.exerciseId)?.muscles.slice(0, 1) ?? []))];

  const remove = async () => {
    if (!(await confirm({ title: `Eliminar «${t.name}»`, body: 'Tu historial de entrenamientos se conserva. Los días asignados pasarán a descanso.', confirm: 'Eliminar', danger: true }))) return;
    const plan = { ...settings.weekPlan };
    for (const d of Object.keys(plan)) if (plan[+d] === t.id) plan[+d] = null;
    await saveSettings({ weekPlan: plan });
    await db.templates.delete(t.id);
    nav('/rutinas', { replace: true });
  };

  return (
    <Page
      back="/rutinas"
      subtitle={days.map((d) => DAY_NAMES[d]).join(' · ') || 'Sin día asignado'}
      title={t.name}
      actions={
        editing ? (
          <button className="btn h-9 rounded-full bg-accent px-4 text-sm text-onaccent" onClick={() => setParams({}, { replace: true })}>
            <Check size={16} /> Listo
          </button>
        ) : (
          <button className="btn-ghost text-accent" onClick={() => setParams({ editar: '1' }, { replace: true })}>
            <Pencil size={16} /> Editar
          </button>
        )
      }
    >
      <p className="-mt-3 mb-4 text-[15px] text-sub">{t.focus}</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {muscles.map((m) => (
          <span key={m} className="chip">
            {MUSCLE_LABEL[m]}
          </span>
        ))}
      </div>
      <div className="mb-6 grid grid-cols-3 gap-2 text-center">
        {[
          ['Ejercicios', t.items.length],
          ['Series', t.items.reduce((a, i) => a + i.sets, 0)],
          ['Duración', `~${estimateMinutes(t)}′`],
        ].map(([k, v]) => (
          <div key={k} className="card py-3">
            <div className="text-lg font-semibold tnum">{v}</div>
            <div className="text-[11px] uppercase tracking-wide text-mute">{k}</div>
          </div>
        ))}
      </div>

      {!editing && (
        <button
          className="btn-primary mb-7 w-full uppercase tracking-wide"
          onClick={() => (active ? (toast('Ya tienes un entrenamiento en curso'), nav('/entreno')) : start(t))}
        >
          <Play size={18} fill="currentColor" /> {active ? 'Ir al entrenamiento en curso' : 'Comenzar'}
        </button>
      )}

      {editing && (
        <button className="btn-secondary mb-5 w-full" onClick={() => setMeta(true)}>
          <Pencil size={16} /> Nombre y descripción
        </button>
      )}

      <Section title="Ejercicios">
        <div className="card divide-hair">
          {t.items.map((it, i) => {
            const ex = exercises.get(it.exerciseId);
            if (!ex) return null;
            const last = lastPerformance(ex.id, sessions);
            const reps = it.repsLabel ?? (it.repMin === it.repMax ? `${it.sets} × ${it.repMax}` : `${it.sets} × ${it.repMin}–${it.repMax}`);
            return (
              <div key={i} className="flex items-stretch">
                {editing && (
                  <div className="flex flex-col justify-center pl-2">
                    <button className="btn-icon h-9 w-9" aria-label="Subir" disabled={i === 0} onClick={() => save((x) => { const [m] = x.items.splice(i, 1); x.items.splice(i - 1, 0, m); })}>
                      <ArrowUp size={16} />
                    </button>
                    <button className="btn-icon h-9 w-9" aria-label="Bajar" disabled={i === t.items.length - 1} onClick={() => save((x) => { const [m] = x.items.splice(i, 1); x.items.splice(i + 1, 0, m); })}>
                      <ArrowDown size={16} />
                    </button>
                  </div>
                )}
                <button className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left active:bg-raised" onClick={() => (editing ? setEditItem(i) : nav(`/ejercicio/${ex.id}`))}>
                  <span className="w-5 shrink-0 text-sm text-mute tnum">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium leading-snug">{ex.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-sub tnum">
                      <span>{reps}</span>
                      <span className="text-mute">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} /> {it.restSec ? formatDuration(it.restSec * 1000) : '0:00'}
                      </span>
                      <span className="text-mute">·</span>
                      <span>Inicial: {it.startLabel || '—'}</span>
                    </span>
                    {last && !editing && (
                      <span className="mt-1 block truncate text-[12px] text-mute tnum">
                        {relativeDay(last.session.startedAt)}: {fmtSets(last.entry.sets, w)}
                      </span>
                    )}
                    {ex.caution && !editing && (
                      <span className="mt-1 flex items-center gap-1 text-[12px] text-warn">
                        <AlertTriangle size={12} /> {ex.caution}
                      </span>
                    )}
                  </span>
                  {editing ? <Pencil size={16} className="text-mute" /> : <ChevronRight size={18} className="text-mute" />}
                </button>
              </div>
            );
          })}
          {!t.items.length && <div className="px-4 py-8 text-center text-sm text-sub">Sin ejercicios todavía.</div>}
        </div>
        {editing && (
          <button className="btn-secondary mt-3 w-full" onClick={() => setPicker(true)}>
            <Plus size={18} /> Añadir ejercicio
          </button>
        )}
      </Section>

      {editing && (
        <button className="btn-ghost w-full text-bad" onClick={remove}>
          <Trash2 size={16} /> Eliminar rutina
        </button>
      )}

      {!editing && t.items.length > 0 && (
        <Section title="Técnica">
          <div className="card divide-hair">
            {t.items.map((it, i) => {
              const ex = exercises.get(it.exerciseId);
              return (
                <Link key={i} to={`/ejercicio/${it.exerciseId}`} className="block px-4 py-3.5">
                  <div className="text-[13px] font-semibold">{ex?.name}</div>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-sub">{it.tip ?? ex?.tip}</p>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(ex) => {
          setPicker(false);
          save((x) => {
            x.items.push({ exerciseId: ex.id, sets: 3, repMin: 8, repMax: 12, startLabel: 'A probar', restSec: ex.compound ? settings.restCompound : settings.restIsolation });
          }).then(() => setEditItem(t.items.length));
        }}
      />

      {editItem != null && t.items[editItem] && (
        <ItemEditor
          item={t.items[editItem]}
          name={exercises.get(t.items[editItem].exerciseId)?.name ?? ''}
          onClose={() => setEditItem(null)}
          onSave={(item) => save((x) => void (x.items[editItem] = item)).then(() => setEditItem(null))}
          onDelete={() => save((x) => void x.items.splice(editItem, 1)).then(() => setEditItem(null))}
        />
      )}

      {meta && <MetaEditor t={t} onClose={() => setMeta(false)} onSave={(p) => save((x) => Object.assign(x, p)).then(() => setMeta(false))} />}
    </Page>
  );
}

function ItemEditor({ item, name, onClose, onSave, onDelete }: { item: TemplateItem; name: string; onClose: () => void; onSave: (i: TemplateItem) => void; onDelete: () => void }) {
  const [v, setV] = useState<TemplateItem>({ ...item });
  const toast = useToast();
  const set = <K extends keyof TemplateItem>(k: K, val: TemplateItem[K]) => setV((x) => ({ ...x, [k]: val }));
  const submit = () => {
    if (!v.sets || v.sets < 1) return toast('Al menos 1 serie');
    if (v.repMin > v.repMax) return toast('El mínimo de reps no puede superar al máximo');
    onSave(v);
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={name}
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button className="btn h-12 w-12 bg-raised text-bad" aria-label="Quitar de la rutina" onClick={onDelete}>
            <Trash2 size={18} />
          </button>
          <button className="btn h-12 bg-accent text-onaccent" onClick={submit}>
            Guardar
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <Field label="Series">
          <NumInput ariaLabel="Series" decimal={false} value={v.sets} onChange={(n) => set('sets', n ?? 0)} />
        </Field>
        <Field label="Reps mín.">
          <NumInput ariaLabel="Reps mínimas" decimal={false} value={v.repMin} onChange={(n) => set('repMin', n ?? 0)} />
        </Field>
        <Field label="Reps máx.">
          <NumInput ariaLabel="Reps máximas" decimal={false} value={v.repMax} onChange={(n) => set('repMax', n ?? 0)} />
        </Field>
      </div>
      <Field label="Descanso" className="mt-4">
        <div className="grid grid-cols-5 gap-1.5">
          {[0, 60, 90, 120, 150, 180, 45, 75, 210, 240].sort((a, b) => a - b).map((s) => (
            <button key={s} className={`btn h-10 text-sm tnum ${v.restSec === s ? 'bg-accent text-onaccent' : 'bg-raised'}`} onClick={() => set('restSec', s)}>
              {formatDuration(s * 1000)}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Peso inicial (texto)" className="mt-4">
        <input className="field" value={v.startLabel} onChange={(e) => set('startLabel', e.target.value)} />
      </Field>
      <Field label="Texto de series (opcional)" className="mt-4">
        <input className="field" placeholder="Ej. 3 × 10 por pierna" value={v.repsLabel ?? ''} onChange={(e) => set('repsLabel', e.target.value || undefined)} />
      </Field>
      <Field label="Consigna para este día (opcional)" className="mt-4">
        <textarea className="field h-24 py-3" value={v.tip ?? ''} onChange={(e) => set('tip', e.target.value || undefined)} />
      </Field>
      <p className="mt-3 text-xs text-mute">El historial del ejercicio se conserva aunque cambies o quites el ejercicio de la rutina.</p>
    </Sheet>
  );
}

function MetaEditor({ t, onClose, onSave }: { t: Template; onClose: () => void; onSave: (p: Partial<Template>) => void }) {
  const [name, setName] = useState(t.name);
  const [short, setShort] = useState(t.short);
  const [focus, setFocus] = useState(t.focus);
  const [optional, setOptional] = useState(!!t.optional);
  return (
    <Sheet open onClose={onClose} title="Rutina" footer={<button className="btn h-12 w-full bg-accent text-onaccent" onClick={() => onSave({ name: name.trim() || t.name, short: short.trim().slice(0, 3).toUpperCase() || t.short, focus, optional })}>Guardar</button>}>
      <Field label="Nombre">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Abreviatura (2–3 letras)" className="mt-4">
        <input className="field" maxLength={3} value={short} onChange={(e) => setShort(e.target.value)} />
      </Field>
      <Field label="Músculos / descripción" className="mt-4">
        <input className="field" value={focus} onChange={(e) => setFocus(e.target.value)} />
      </Field>
      <label className="mt-5 flex items-center justify-between">
        <span className="text-[15px]">Opcional</span>
        <input type="checkbox" className="h-6 w-6" checked={optional} onChange={(e) => setOptional(e.target.checked)} />
      </label>
    </Sheet>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="eyebrow mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
