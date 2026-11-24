import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Scale, Ruler, Trash2 } from 'lucide-react';
import { db, uid } from '../db/db';
import type { BodyWeight, Measurement } from '../db/types';
import { Page, Section, Segmented, Sheet, NumInput, Empty, useConfirm, useToast } from '../components/ui';
import { LineChart } from '../components/charts';
import { useBodyweights, useSettings, useUnit } from '../lib/hooks';
import { avgBetween, weightTrend } from '../lib/calc';
import { dayKey, formatDate, formatShort, parseDay, startOfDay } from '../lib/dates';
import { fmtNum, fromUnit, roundDisplay, toUnit } from '../lib/units';

type Range = '7' | '30' | '90' | '180' | '365' | 'todo';

export default function Body() {
  const [tab, setTab] = useState<'peso' | 'medidas'>('peso');
  return (
    <Page title="Cuerpo">
      <div className="mb-6">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'peso', label: 'Peso' }, { value: 'medidas', label: 'Medidas' }]} />
      </div>
      {tab === 'peso' ? <Weight /> : <Measurements />}
    </Page>
  );
}

function Weight() {
  const entries = useBodyweights() ?? [];
  const settings = useSettings();
  const { unit, w, wu } = useUnit();
  const confirm = useConfirm();
  const [range, setRange] = useState<Range>('30');
  const [edit, setEdit] = useState<BodyWeight | 'new' | null>(null);

  const trend = useMemo(() => weightTrend(entries), [entries]);
  const now = Date.now();
  const first = entries[0];
  const last = entries[entries.length - 1];
  const lastTrend = trend[trend.length - 1];
  const today0 = startOfDay(now);
  const avg7 = avgBetween(trend, today0 - 6 * 86400000, today0 + 86400000);
  const avgPrev7 = avgBetween(trend, today0 - 13 * 86400000, today0 - 6 * 86400000);
  const from = range === 'todo' ? 0 : today0 - (Number(range) - 1) * 86400000;
  const shown = trend.filter((p) => p.t >= from);
  const bmi = last && settings.heightCm ? last.kg / Math.pow(settings.heightCm / 100, 2) : null;

  // Ritmo semanal según la tendencia de las últimas 4 semanas.
  const pace = useMemo(() => {
    if (trend.length < 2) return null;
    const end = trend[trend.length - 1];
    const startPt = trend.find((p) => p.t >= end.t - 28 * 86400000) ?? trend[0];
    const days = (end.t - startPt.t) / 86400000;
    if (days < 7) return null;
    return ((end.trend - startPt.trend) / days) * 7;
  }, [trend]);

  return (
    <>
      {!entries.length ? (
        <Empty icon={<Scale size={28} />} title="Sin pesadas" body="Pésate por la mañana, en ayunas, para que los datos sean comparables." action={<button className="btn-primary" onClick={() => setEdit('new')}>Añadir peso</button>} />
      ) : (
        <>
          <div className="card mb-3 p-5">
            <div className="eyebrow">Peso actual</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[44px] font-semibold leading-none tracking-tight tnum">{w(last.kg)}</span>
              <span className="text-lg text-sub">{unit}</span>
            </div>
            <div className="mt-2 text-[13px] text-sub">{formatDate(parseDay(last.date).getTime())}</div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t hairline pt-4 text-[13px]">
              <div>
                <div className="text-mute">Inicio</div>
                <div className="font-semibold tnum">{wu(first.kg)}</div>
              </div>
              <div>
                <div className="text-mute">Diferencia</div>
                <div className="font-semibold tnum">
                  {last.kg - first.kg >= 0 ? '+' : '−'}
                  {wu(Math.abs(last.kg - first.kg))}
                </div>
              </div>
              <div>
                <div className="text-mute">Tendencia</div>
                <div className="font-semibold tnum">{wu(lastTrend.trend)}</div>
              </div>
            </div>
          </div>
          <div className="mb-7 grid grid-cols-3 gap-2">
            <MiniStat label="Media 7 días" value={avg7 != null ? wu(avg7) : '—'} foot={avg7 != null && avgPrev7 != null ? `${avg7 - avgPrev7 >= 0 ? '+' : '−'}${w(Math.abs(avg7 - avgPrev7))} vs anterior` : undefined} />
            <MiniStat label="Ritmo" value={pace != null ? `${pace >= 0 ? '+' : '−'}${w(Math.abs(pace))}` : '—'} foot={pace != null ? `${unit}/semana` : 'Faltan datos'} />
            <MiniStat label="IMC" value={bmi ? fmtNum(bmi, 1) : '—'} foot={settings.goalWeightKg ? `Meta ${wu(settings.goalWeightKg)}` : undefined} />
          </div>
        </>
      )}

      {entries.length > 0 && (
        <Section title="Evolución">
          <div className="card p-4">
            <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
              {(['7', '30', '90', '180', '365', 'todo'] as Range[]).map((r) => (
                <button key={r} onClick={() => setRange(r)} className={`chip h-8 shrink-0 px-3 ${range === r ? '!bg-ink !text-bg' : ''}`}>
                  {r === '7' ? '7 d' : r === '30' ? '30 d' : r === '90' ? '3 m' : r === '180' ? '6 m' : r === '365' ? '1 año' : 'Todo'}
                </button>
              ))}
            </div>
            {shown.length ? (
              <LineChart
                data={shown.map((p) => ({ x: p.t, y: toUnit(p.kg, unit), y2: toUnit(p.trend, unit) }))}
                fmtX={formatShort}
                fmtY={(v) => fmtNum(v, 1)}
                goal={settings.goalWeightKg ? toUnit(settings.goalWeightKg, unit) : undefined}
                goalLabel="Meta"
                primaryLabel="Pesadas"
                secondaryLabel="Tendencia (media suavizada)"
                area={false}
                tooltip={(p) => (
                  <>
                    <div className="text-mute">{formatDate(p.x)}</div>
                    <div className="font-semibold tnum text-ink">
                      {fmtNum(p.y, 1)} {unit}
                    </div>
                    <div className="text-mute tnum">Tendencia {fmtNum(p.y2 ?? p.y, 1)}</div>
                  </>
                )}
              />
            ) : (
              <p className="py-8 text-center text-sm text-sub">Sin pesadas en este periodo.</p>
            )}
            <p className="mt-3 text-xs text-mute">La tendencia es una media móvil exponencial: suaviza las subidas y bajadas diarias de agua y comida para mostrar el cambio real.</p>
          </div>
        </Section>
      )}

      {entries.length > 0 && (
        <Section title="Registro">
          <div className="card divide-hair">
            {[...entries].reverse().slice(0, 60).map((e, i, arr) => {
              const prev = arr[i + 1];
              const d = prev ? e.kg - prev.kg : null;
              return (
                <button key={e.id} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-raised" onClick={() => setEdit(e)}>
                  <span className="flex-1 text-[15px]">{formatDate(parseDay(e.date).getTime())}</span>
                  {d != null && Math.abs(d) > 0.001 && <span className="text-[13px] text-mute tnum">{d > 0 ? '+' : '−'}{w(Math.abs(d))}</span>}
                  <span className="w-20 text-right font-semibold tnum">{wu(e.kg)}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <button className="btn fixed z-30 h-14 w-14 rounded-full bg-accent text-onaccent shadow-xl" style={{ right: 20, bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }} aria-label="Añadir peso" onClick={() => setEdit('new')}>
        <Plus size={26} />
      </button>

      {edit && (
        <WeightEditor
          entry={edit === 'new' ? null : edit}
          lastKg={last?.kg}
          onClose={() => setEdit(null)}
          onDelete={async (e) => {
            if (await confirm({ title: 'Eliminar pesada', confirm: 'Eliminar', danger: true })) {
              await db.bodyweights.delete(e.id);
              setEdit(null);
            }
          }}
        />
      )}
    </>
  );
}

function WeightEditor({ entry, lastKg, onClose, onDelete }: { entry: BodyWeight | null; lastKg?: number; onClose: () => void; onDelete: (e: BodyWeight) => void }) {
  const { unit } = useUnit();
  const toast = useToast();
  const [date, setDate] = useState(entry?.date ?? dayKey(Date.now()));
  const init = entry?.kg ?? lastKg;
  const [v, setV] = useState<number | null>(init != null ? roundDisplay(toUnit(init, unit), unit) : null);
  const step = unit === 'kg' ? 0.1 : 0.2;

  const save = async () => {
    if (v == null || v <= 0) return toast('Indica tu peso');
    const kg = fromUnit(v, unit);
    if (kg < 25 || kg > 350) return toast('Ese peso no parece correcto');
    // Una pesada por día: si ya existe ese día, se sustituye.
    const same = await db.bodyweights.where('date').equals(date).first();
    if (entry && entry.date !== date && same && same.id !== entry.id) await db.bodyweights.delete(same.id);
    const id = entry?.id ?? same?.id ?? uid('bw-');
    await db.bodyweights.put({ id, date, kg: Math.round(kg * 100) / 100, note: entry?.note });
    toast('Peso guardado');
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={entry ? 'Editar pesada' : 'Nueva pesada'}
      footer={
        <div className={`grid gap-2 ${entry ? 'grid-cols-[auto_1fr]' : ''}`}>
          {entry && (
            <button className="btn h-12 w-12 bg-raised text-bad" aria-label="Eliminar" onClick={() => onDelete(entry)}>
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn h-12 bg-accent text-onaccent" onClick={save}>
            Guardar
          </button>
        </div>
      }
    >
      <div className="flex items-center gap-3">
        <button className="btn h-14 w-14 shrink-0 bg-raised text-2xl" onClick={() => setV((x) => Math.max(0, Math.round(((x ?? 0) - step) * 10) / 10))} aria-label="Menos">
          −
        </button>
        <NumInput ariaLabel="Peso" value={v} onChange={setV} className="h-16 text-3xl" placeholder={unit} />
        <button className="btn h-14 w-14 shrink-0 bg-raised text-2xl" onClick={() => setV((x) => Math.round(((x ?? 0) + step) * 10) / 10)} aria-label="Más">
          +
        </button>
      </div>
      <div className="mt-1 text-center text-sm text-mute">{unit}</div>
      <label className="mt-5 block">
        <span className="eyebrow mb-1.5 block">Fecha</span>
        <input type="date" className="field" value={date} max={dayKey(Date.now())} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
    </Sheet>
  );
}

function MiniStat({ label, value, foot }: { label: string; value: string; foot?: string }) {
  return (
    <div className="card p-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 text-[16px] font-semibold tnum leading-tight">{value}</div>
      {foot && <div className="mt-0.5 text-[11px] text-mute tnum">{foot}</div>}
    </div>
  );
}

// ── Medidas

const FIELDS: { key: 'cintura' | 'brazo' | 'pecho' | 'muslo'; label: string }[] = [
  { key: 'cintura', label: 'Cintura' },
  { key: 'pecho', label: 'Pecho' },
  { key: 'brazo', label: 'Brazo' },
  { key: 'muslo', label: 'Muslo' },
];

function Measurements() {
  const list = useLiveQuery(() => db.measurements.orderBy('date').toArray(), []) ?? [];
  const [edit, setEdit] = useState<Measurement | 'new' | null>(null);
  const [field, setField] = useState<(typeof FIELDS)[number]['key']>('brazo');
  const confirm = useConfirm();
  const pts = list.filter((m) => m[field] != null).map((m) => ({ x: parseDay(m.date).getTime(), y: m[field]! }));

  return (
    <>
      {!list.length ? (
        <Empty icon={<Ruler size={28} />} title="Sin medidas" body="Mide siempre en el mismo punto y a la misma hora. Todos los campos son opcionales." action={<button className="btn-primary" onClick={() => setEdit('new')}>Añadir medidas</button>} />
      ) : (
        <>
          <div className="mb-7 grid grid-cols-2 gap-3">
            {FIELDS.map((f) => {
              const firstV = list.find((m) => m[f.key] != null)?.[f.key];
              const lastV = [...list].reverse().find((m) => m[f.key] != null)?.[f.key];
              return (
                <button key={f.key} className={`card p-4 text-left ${field === f.key ? 'ring-1 ring-accent' : ''}`} onClick={() => setField(f.key)}>
                  <div className="eyebrow">{f.label}</div>
                  <div className="mt-1 text-[24px] font-semibold tnum leading-none">
                    {lastV != null ? fmtNum(lastV, 1) : '—'} <span className="text-sm font-normal text-sub">cm</span>
                  </div>
                  <div className="mt-1.5 text-xs text-sub tnum">{firstV != null && lastV != null && list.length > 1 ? `${lastV - firstV >= 0 ? '+' : '−'}${fmtNum(Math.abs(lastV - firstV), 1)} cm desde el inicio` : ' '}</div>
                </button>
              );
            })}
          </div>
          {pts.length > 1 && (
            <Section title={FIELDS.find((f) => f.key === field)!.label}>
              <div className="card p-4">
                <LineChart data={pts} fmtX={formatShort} fmtY={(v) => fmtNum(v, 1)} height={150} />
              </div>
            </Section>
          )}
          <Section title="Registro">
            <div className="card divide-hair">
              {[...list].reverse().map((m) => (
                <button key={m.id} className="block w-full px-4 py-3 text-left active:bg-raised" onClick={() => setEdit(m)}>
                  <div className="text-[13px] text-sub">{formatDate(parseDay(m.date).getTime())}</div>
                  <div className="mt-0.5 text-[14px] tnum">
                    {FIELDS.filter((f) => m[f.key] != null).map((f) => `${f.label} ${fmtNum(m[f.key]!, 1)}`).join(' · ') || '—'}
                  </div>
                  {m.otros && <div className="text-[13px] text-mute">{m.otros}</div>}
                </button>
              ))}
            </div>
          </Section>
        </>
      )}
      <button className="btn fixed z-30 h-14 w-14 rounded-full bg-accent text-onaccent shadow-xl" style={{ right: 20, bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }} aria-label="Añadir medidas" onClick={() => setEdit('new')}>
        <Plus size={26} />
      </button>
      {edit && (
        <MeasureEditor
          entry={edit === 'new' ? null : edit}
          onClose={() => setEdit(null)}
          onDelete={async (m) => {
            if (await confirm({ title: 'Eliminar medidas', confirm: 'Eliminar', danger: true })) {
              await db.measurements.delete(m.id);
              setEdit(null);
            }
          }}
        />
      )}
    </>
  );
}

function MeasureEditor({ entry, onClose, onDelete }: { entry: Measurement | null; onClose: () => void; onDelete: (m: Measurement) => void }) {
  const toast = useToast();
  const [m, setM] = useState<Measurement>(entry ?? { id: uid('m-'), date: dayKey(Date.now()) });
  const save = async () => {
    if (!FIELDS.some((f) => m[f.key] != null) && !m.otros?.trim()) return toast('Rellena al menos una medida');
    await db.measurements.put(m);
    toast('Medidas guardadas');
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={entry ? 'Editar medidas' : 'Nuevas medidas'}
      footer={
        <div className={`grid gap-2 ${entry ? 'grid-cols-[auto_1fr]' : ''}`}>
          {entry && (
            <button className="btn h-12 w-12 bg-raised text-bad" aria-label="Eliminar" onClick={() => onDelete(entry)}>
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn h-12 bg-accent text-onaccent" onClick={save}>
            Guardar
          </button>
        </div>
      }
    >
      <label className="block">
        <span className="eyebrow mb-1.5 block">Fecha</span>
        <input type="date" className="field" value={m.date} onChange={(e) => e.target.value && setM({ ...m, date: e.target.value })} />
      </label>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="eyebrow mb-1.5 block">{f.label} (cm)</span>
            <NumInput ariaLabel={f.label} value={m[f.key] ?? null} placeholder="—" onChange={(v) => setM({ ...m, [f.key]: v ?? undefined })} />
          </label>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="eyebrow mb-1.5 block">Otras medidas</span>
        <input className="field" placeholder="Ej. antebrazo 30, gemelo 38" value={m.otros ?? ''} onChange={(e) => setM({ ...m, otros: e.target.value || undefined })} />
      </label>
    </Sheet>
  );
}
