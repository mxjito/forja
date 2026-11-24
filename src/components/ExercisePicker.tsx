import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Sheet, useToast } from './ui';
import { useExercises } from '../lib/hooks';
import { db, uid } from '../db/db';
import type { Equipment, Exercise, Muscle } from '../db/types';
import { EQUIP_LABEL, MUSCLE_LABEL } from '../lib/calc';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function ExercisePicker({ open, onClose, onPick, title = 'Añadir ejercicio' }: { open: boolean; onClose: () => void; onPick: (ex: Exercise) => void; title?: string }) {
  const exercises = useExercises();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const list = useMemo(() => {
    const all = [...exercises.values()].sort((a, b) => Number(!!a.legacy) - Number(!!b.legacy) || a.name.localeCompare(b.name, 'es'));
    const nq = norm(q);
    return nq ? all.filter((e) => norm(e.name).includes(nq) || e.muscles.some((m) => norm(MUSCLE_LABEL[m]).includes(nq))) : all;
  }, [exercises, q]);

  return (
    <Sheet open={open} onClose={onClose} title={creating ? 'Nuevo ejercicio' : title}>
      {creating ? (
        <NewExercise
          initialName={q}
          onCancel={() => setCreating(false)}
          onCreated={(ex) => {
            setCreating(false);
            onPick(ex);
          }}
        />
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
              <input className="field pl-10" placeholder="Buscar ejercicio o músculo" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="card divide-hair">
            {list.map((e) => (
              <button key={e.id} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-raised" onClick={() => onPick(e)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{e.name}</span>
                  <span className="block text-[12px] text-mute">
                    {e.muscles.map((m) => MUSCLE_LABEL[m]).join(', ')} · {EQUIP_LABEL[e.equipment]}
                    {e.legacy ? ' · programa anterior' : ''}
                  </span>
                </span>
                <Plus size={18} className="text-accent" />
              </button>
            ))}
            {!list.length && <div className="px-4 py-6 text-center text-sm text-sub">Sin resultados</div>}
          </div>
          <button className="btn-secondary mt-3 w-full" onClick={() => setCreating(true)}>
            <Plus size={18} /> Crear ejercicio{q ? ` «${q}»` : ''}
          </button>
        </>
      )}
    </Sheet>
  );
}

const MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[];
const EQUIP = Object.keys(EQUIP_LABEL) as Equipment[];

function NewExercise({ initialName, onCancel, onCreated }: { initialName: string; onCancel: () => void; onCreated: (e: Exercise) => void }) {
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [equipment, setEquipment] = useState<Equipment>('maquina');
  const [compound, setCompound] = useState(false);
  const [tip, setTip] = useState('');

  const save = async () => {
    const n = name.trim();
    if (n.length < 2) return toast('Escribe un nombre');
    if (!muscles.length) return toast('Elige al menos un músculo');
    const ex: Exercise = {
      id: uid('ex-'),
      name: n,
      muscles,
      equipment,
      compound,
      tip: tip.trim(),
      increment: equipment === 'mancuerna' ? 2 : 2.5,
      bodyweight: equipment === 'corporal',
      custom: true,
    };
    await db.exercises.add(ex);
    onCreated(ex);
  };

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="eyebrow">Nombre</span>
        <input className="field mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Press de hombro en máquina" autoFocus />
      </label>
      <div>
        <span className="eyebrow">Músculos (el primero es el principal)</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {MUSCLES.map((m) => {
            const i = muscles.indexOf(m);
            return (
              <button key={m} onClick={() => setMuscles(i >= 0 ? muscles.filter((x) => x !== m) : [...muscles, m])} className={`chip h-9 px-3 text-[13px] ${i >= 0 ? '!bg-accent !text-onaccent' : ''}`}>
                {i === 0 ? '★ ' : ''}
                {MUSCLE_LABEL[m]}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <span className="eyebrow">Material</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {EQUIP.map((e) => (
            <button key={e} onClick={() => setEquipment(e)} className={`chip h-9 px-3 text-[13px] ${equipment === e ? '!bg-accent !text-onaccent' : ''}`}>
              {EQUIP_LABEL[e]}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center justify-between">
        <span>
          <span className="block text-[15px]">Ejercicio grande</span>
          <span className="block text-[13px] text-sub">Descanso largo (2–3 min)</span>
        </span>
        <input type="checkbox" className="h-6 w-6 accent-[rgb(var(--accent))]" checked={compound} onChange={(e) => setCompound(e.target.checked)} />
      </label>
      <label className="block">
        <span className="eyebrow">Técnica (opcional)</span>
        <textarea className="field mt-1.5 h-24 py-3" value={tip} onChange={(e) => setTip(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={onCancel}>
          Volver
        </button>
        <button className="btn h-12 bg-accent text-onaccent" onClick={save}>
          Crear
        </button>
      </div>
    </div>
  );
}
