import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Camera, Target, Trash2, Trophy, AlertTriangle } from 'lucide-react';
import { db } from '../db/db';
import { Page, Section, Segmented, NumInput, Sheet, useToast, Empty } from '../components/ui';
import { LineChart } from '../components/charts';
import { useExercises, useSessions, useTemplates, useUnit } from '../lib/hooks';
import { bestsFor, exerciseSeries, fmtSets, EQUIP_LABEL, MUSCLE_LABEL, isLogged } from '../lib/calc';
import { formatDate, formatShort } from '../lib/dates';
import { fmtNum, fromUnit, showVolume, toUnit } from '../lib/units';

type Metric = 'peso' | 'e1rm' | 'volumen' | 'reps';

export default function ExerciseDetail() {
  const { id } = useParams();
  const exercises = useExercises();
  const sessions = useSessions() ?? [];
  const templates = useTemplates() ?? [];
  const { unit, w, wu } = useUnit();
  const toast = useToast();
  const [metric, setMetric] = useState<Metric>('peso');
  const [goalOpen, setGoalOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ex = exercises.get(id!);

  const series = useMemo(() => exerciseSeries(id!, sessions), [id, sessions]);
  const bests = useMemo(() => bestsFor(id!, sessions), [id, sessions]);
  const history = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'terminada')
        .sort((a, b) => b.startedAt - a.startedAt)
        .flatMap((s) => s.exercises.filter((e) => e.exerciseId === id && e.sets.some(isLogged)).map((e) => ({ s, e }))),
    [sessions, id],
  );

  if (!ex) return <Page back title=" ">{null}</Page>;
  const inTemplates = templates.filter((t) => t.items.some((i) => i.exerciseId === ex.id || i.alternatives?.includes(ex.id)));

  const chartData = series
    .map((p) => {
      const y = metric === 'peso' ? toUnit(p.topWeight, unit) : metric === 'e1rm' ? (p.e1rm != null ? toUnit(p.e1rm, unit) : null) : metric === 'volumen' ? toUnit(p.volume, unit) : p.totalReps;
      return y == null || (metric === 'volumen' && y === 0) ? null : { x: p.t, y };
    })
    .filter((x): x is { x: number; y: number } => !!x);

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      const url = await resizeImage(f, 1024);
      await db.exercises.update(ex.id, { photo: url });
      toast('Foto guardada');
    } catch {
      toast('No se pudo leer la imagen');
    }
  };

  const fmtY = (v: number) => (metric === 'reps' ? fmtNum(v, 0) : metric === 'volumen' ? fmtNum(v, 0) : fmtNum(v, 1));

  return (
    <Page back subtitle={`${EQUIP_LABEL[ex.equipment]}${ex.legacy ? ' · programa anterior' : ''}`} title={ex.name}>
      <div className="-mt-2 mb-5 flex flex-wrap gap-2">
        {ex.muscles.map((m, i) => (
          <span key={m} className={`chip ${i === 0 ? '!bg-accent/15 !text-accent' : ''}`}>
            {MUSCLE_LABEL[m]}
          </span>
        ))}
      </div>

      {/* ── Foto */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      {ex.photo ? (
        <div className="relative mb-6">
          <img src={ex.photo} alt={ex.name} className="aspect-[4/3] w-full rounded-2xl object-cover" />
          <div className="absolute bottom-3 right-3 flex gap-2">
            <button className="btn h-10 rounded-full bg-black/60 px-3 text-sm text-white backdrop-blur" onClick={() => fileRef.current?.click()}>
              <Camera size={16} /> Cambiar
            </button>
            <button className="btn h-10 w-10 rounded-full bg-black/60 text-white backdrop-blur" aria-label="Quitar foto" onClick={() => db.exercises.update(ex.id, { photo: undefined })}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button className="card mb-6 flex w-full items-center gap-3 p-4 text-left" onClick={() => fileRef.current?.click()}>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-raised text-sub">
            <Camera size={20} />
          </span>
          <span className="flex-1">
            <span className="block font-medium">Añadir foto</span>
            <span className="block text-[13px] text-sub">Fotografía la máquina de tu gym para reconocerla. Se guarda solo en el teléfono.</span>
          </span>
        </button>
      )}

      <Section title="Cómo hacerlo bien">
        <div className="card p-4">
          <p className="text-[15px] leading-relaxed">{ex.tip}</p>
          {inTemplates.map((t) => {
            const it = t.items.find((i) => i.exerciseId === ex.id);
            return it?.tip && it.tip !== ex.tip ? (
              <p key={t.id} className="mt-3 border-t hairline pt-3 text-[14px] leading-relaxed text-sub">
                <b className="text-ink">{t.name}:</b> {it.tip}
              </p>
            ) : null;
          })}
          {ex.caution && (
            <div className="mt-3 flex gap-2 rounded-xl p-3 text-[14px]" style={{ background: 'rgb(var(--warn) / 0.1)' }}>
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-warn" /> {ex.caution}
            </div>
          )}
        </div>
      </Section>

      {/* ── Récords */}
      <Section title="Récords" action={<button className="text-sm text-accent" onClick={() => setGoalOpen(true)}><Target size={14} className="inline -mt-0.5" /> {ex.goalKg ? `Objetivo ${wu(ex.goalKg)}` : 'Objetivo'}</button>}>
        <div className="grid grid-cols-3 gap-2">
          <Mini label="Peso máx." value={bests.maxWeight ? w(bests.maxWeight) : '—'} unit={bests.maxWeight ? unit : ''} />
          <Mini label="1RM est.*" value={bests.maxE1rm ? w(bests.maxE1rm) : '—'} unit={bests.maxE1rm ? unit : ''} />
          <Mini label="Vol. máx." value={bests.maxVolume ? showVolume(bests.maxVolume, unit).split(' ')[0] : '—'} unit={bests.maxVolume ? showVolume(bests.maxVolume, unit).split(' ')[1] : ''} />
        </div>
        {ex.goalKg && bests.maxWeight > 0 && (
          <div className="card mt-2 p-4">
            <div className="flex justify-between text-[13px]">
              <span className="text-sub">Hacia tu objetivo</span>
              <span className="tnum">
                {w(bests.maxWeight)} / {wu(ex.goalKg)}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-raised">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (bests.maxWeight / ex.goalKg) * 100)}%` }} />
            </div>
          </div>
        )}
        <p className="mt-2 px-1 text-xs text-mute">*1RM estimado con la fórmula de Epley a partir de series de 1–12 reps. Es una estimación, no un máximo real.</p>
      </Section>

      {/* ── Gráfica */}
      <Section title="Evolución">
        {chartData.length ? (
          <div className="card p-4">
            <Segmented
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'peso', label: 'Carga' },
                { value: 'e1rm', label: '1RM est.' },
                { value: 'volumen', label: 'Volumen' },
                { value: 'reps', label: 'Reps' },
              ]}
            />
            <div className="mt-4">
              <LineChart
                data={chartData}
                fmtX={(t) => formatShort(t)}
                fmtY={fmtY}
                goal={metric === 'peso' && ex.goalKg ? toUnit(ex.goalKg, unit) : undefined}
                goalLabel="Objetivo"
                tooltip={(p) => (
                  <>
                    <div className="text-mute">{formatDate(p.x)}</div>
                    <div className="font-semibold tnum text-ink">
                      {fmtY(p.y)} {metric === 'reps' ? 'reps' : unit}
                    </div>
                  </>
                )}
              />
            </div>
            <p className="mt-2 text-xs text-mute">
              {metric === 'peso' ? 'Peso más alto de cada sesión.' : metric === 'e1rm' ? 'Mejor 1RM estimado de cada sesión.' : metric === 'volumen' ? 'Peso × reps de todas las series.' : 'Reps totales de la sesión.'}
            </p>
          </div>
        ) : (
          <Empty title="Aún sin datos" body="Cuando registres este ejercicio verás aquí tu evolución." />
        )}
      </Section>

      {/* ── Historial */}
      {history.length > 0 && (
        <Section title={`Historial · ${history.length}`}>
          <div className="card divide-hair">
            {history.map(({ s, e }, i) => (
              <Link key={i} to={`/historial/${s.id}`} className="block px-4 py-3">
                <div className="flex justify-between text-[13px]">
                  <span className="text-sub">{formatDate(s.startedAt)}</span>
                  <span className="text-mute tnum">{e.sets.filter(isLogged).length} series</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[15px] tnum">
                  {e.sets.some((x) => x.pr?.length) && <Trophy size={14} className="text-accent" />}
                  {fmtSets(e.sets, w)}
                </div>
                {e.note && <div className="mt-0.5 text-[13px] text-sub">“{e.note}”</div>}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {inTemplates.length > 0 && (
        <Section title="En tus rutinas">
          <div className="flex flex-wrap gap-2">
            {inTemplates.map((t) => (
              <Link key={t.id} to={`/rutinas/${t.id}`} className="chip h-9 px-3.5 text-[13px]">
                {t.name}
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="Progresión">
        <IncrementEditor id={ex.id} kg={ex.increment} />
      </Section>

      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)} title="Objetivo de peso">
        <GoalEditor
          current={ex.goalKg}
          onSave={async (kg) => {
            await db.exercises.update(ex.id, { goalKg: kg ?? undefined });
            setGoalOpen(false);
          }}
        />
      </Sheet>
    </Page>
  );
}

function Mini({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="card p-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 text-[19px] font-semibold tnum leading-tight">
        {value} <span className="text-xs font-normal text-sub">{unit}</span>
      </div>
    </div>
  );
}

function GoalEditor({ current, onSave }: { current?: number; onSave: (kg: number | null) => void }) {
  const { unit } = useUnit();
  const [v, setV] = useState<number | null>(current != null ? Math.round(toUnit(current, unit) * 4) / 4 : null);
  return (
    <div>
      <NumInput ariaLabel="Objetivo" value={v} onChange={setV} placeholder={unit} className="h-14 text-2xl" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={() => onSave(null)}>
          Quitar objetivo
        </button>
        <button className="btn h-12 bg-accent text-onaccent" onClick={() => onSave(v == null ? null : fromUnit(v, unit))}>
          Guardar
        </button>
      </div>
    </div>
  );
}

function IncrementEditor({ id, kg }: { id: string; kg: number }) {
  const opts = [1, 1.25, 2, 2.5, 5];
  return (
    <div className="card p-4">
      <div className="text-[15px]">Salto de peso al subir</div>
      <div className="mb-3 text-[13px] text-sub">Regla 2: 2,5 kg o la siguiente mancuerna.</div>
      <div className="grid grid-cols-5 gap-1.5">
        {opts.map((o) => (
          <button key={o} className={`btn h-10 text-sm tnum ${kg === o ? 'bg-accent text-onaccent' : 'bg-raised'}`} onClick={() => db.exercises.update(id, { increment: o })}>
            {String(o).replace('.', ',')}
          </button>
        ))}
      </div>
      <div className="mt-2 text-right text-xs text-mute">kg</div>
    </div>
  );
}

function resizeImage(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}
