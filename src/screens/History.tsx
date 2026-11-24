import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronRight, GitCompare, SlidersHorizontal, Trophy, History as HistoryIcon } from 'lucide-react';
import { Page, Sheet, Empty, Segmented } from '../components/ui';
import { useExercises, useSessions, useTemplates, useUnit } from '../lib/hooks';
import { finished, sessionDuration, sessionSetCount, sessionVolume } from '../lib/calc';
import { formatDate, formatMinutes, formatTime } from '../lib/dates';
import { showVolume } from '../lib/units';

type Period = 'todo' | '30' | '90' | '365';

export default function History() {
  const sessions = useSessions();
  const templates = useTemplates() ?? [];
  const exercises = useExercises();
  const { unit } = useUnit();
  const nav = useNavigate();
  const [tpl, setTpl] = useState<string>('todas');
  const [exId, setExId] = useState<string>('');
  const [period, setPeriod] = useState<Period>('todo');
  const [filters, setFilters] = useState(false);
  const [compare, setCompare] = useState<string[] | null>(null);

  const list = useMemo(() => {
    const now = Date.now();
    return finished(sessions ?? []).filter(
      (s) =>
        (tpl === 'todas' || (tpl === 'libre' ? !s.templateId : s.templateId === tpl)) &&
        (!exId || s.exercises.some((e) => e.exerciseId === exId)) &&
        (period === 'todo' || s.startedAt >= now - Number(period) * 86400000),
    );
  }, [sessions, tpl, exId, period]);

  const groups = useMemo(() => {
    const m = new Map<string, typeof list>();
    const fmt = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
    for (const s of list) {
      const k = fmt.format(s.startedAt);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [list]);

  const usedExercises = useMemo(() => {
    const ids = new Set(finished(sessions ?? []).flatMap((s) => s.exercises.map((e) => e.exerciseId)));
    return [...ids].map((id) => exercises.get(id)).filter(Boolean).sort((a, b) => a!.name.localeCompare(b!.name, 'es'));
  }, [sessions, exercises]);

  const activeFilters = (tpl !== 'todas' ? 1 : 0) + (exId ? 1 : 0) + (period !== 'todo' ? 1 : 0);

  const toggleCompare = (id: string) => {
    if (!compare) return;
    const next = compare.includes(id) ? compare.filter((x) => x !== id) : [...compare, id].slice(-2);
    setCompare(next);
  };

  return (
    <Page
      title="Historial"
      subtitle={`${list.length} entrenamiento${list.length === 1 ? '' : 's'}`}
      actions={
        <>
          <button className={`btn-icon ${compare ? 'text-accent' : ''}`} aria-label="Comparar dos sesiones" onClick={() => setCompare(compare ? null : [])}>
            <GitCompare size={20} />
          </button>
          <button className="btn-icon relative" aria-label="Filtros" onClick={() => setFilters(true)}>
            <SlidersHorizontal size={20} />
            {activeFilters > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-onaccent">{activeFilters}</span>}
          </button>
        </>
      }
    >
      <div className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {[{ id: 'todas', name: 'Todas' }, ...templates, { id: 'libre', name: 'Libre / importadas' }].map((t) => (
          <button key={t.id} onClick={() => setTpl(t.id)} className={`chip h-9 shrink-0 px-3.5 text-[13px] ${tpl === t.id ? '!bg-ink !text-bg' : ''}`}>
            {t.name}
          </button>
        ))}
      </div>

      {compare && (
        <div className="card mb-5 flex items-center gap-3 p-3 pl-4 anim-rise">
          <span className="flex-1 text-sm text-sub">{compare.length < 2 ? `Elige ${2 - compare.length} sesión${compare.length ? '' : 'es'} para comparar` : 'Listo para comparar'}</span>
          <button className="btn h-10 bg-accent px-4 text-sm text-onaccent" disabled={compare.length < 2} onClick={() => nav(`/comparar?a=${compare[0]}&b=${compare[1]}`)}>
            Comparar
          </button>
        </div>
      )}

      {!list.length ? (
        <Empty icon={<HistoryIcon size={28} />} title={activeFilters ? 'Nada con estos filtros' : 'Sin entrenamientos todavía'} body={activeFilters ? 'Prueba a quitar algún filtro.' : 'Cuando termines tu primera sesión aparecerá aquí.'} />
      ) : (
        groups.map(([month, items]) => (
          <section key={month} className="mb-6">
            <h2 className="mb-2 px-1 text-[13px] font-semibold capitalize text-mute">{month}</h2>
            <div className="card divide-hair">
              {items.map((s) => {
                const sel = compare?.includes(s.id);
                const prs = s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.pr?.length).length, 0);
                const inner = (
                  <>
                    {compare && (
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${sel ? 'bg-accent text-onaccent' : 'bg-raised'}`}>
                        {sel && <Check size={14} strokeWidth={3} />}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-medium">{s.name}</span>
                        {prs > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-accent">
                            <Trophy size={12} /> {prs}
                          </span>
                        )}
                      </span>
                      <span className="block text-[13px] text-sub">
                        {formatDate(s.startedAt)} · {formatTime(s.startedAt)}
                        {s.imported ? ' · importada' : ''}
                      </span>
                      <span className="mt-1 block truncate text-[12px] text-mute">{s.exercises.map((e) => exercises.get(e.exerciseId)?.name).join(', ')}</span>
                    </span>
                    <span className="shrink-0 text-right text-[13px] text-sub tnum">
                      {sessionSetCount(s)} series
                      <br />
                      <span className="text-mute">{s.imported ? showVolume(sessionVolume(s), unit) : formatMinutes(sessionDuration(s))}</span>
                    </span>
                    {!compare && <ChevronRight size={18} className="shrink-0 text-mute" />}
                  </>
                );
                return compare ? (
                  <button key={s.id} className="flex w-full items-center gap-3 px-4 py-3.5 text-left" onClick={() => toggleCompare(s.id)}>
                    {inner}
                  </button>
                ) : (
                  <Link key={s.id} to={`/historial/${s.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-raised">
                    {inner}
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}

      <Sheet open={filters} onClose={() => setFilters(false)} title="Filtros" footer={<button className="btn h-12 w-full bg-accent text-onaccent" onClick={() => setFilters(false)}>Ver {list.length} resultados</button>}>
        <div className="eyebrow mb-2">Periodo</div>
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'todo', label: 'Todo' },
            { value: '30', label: '30 días' },
            { value: '90', label: '3 meses' },
            { value: '365', label: '1 año' },
          ]}
        />
        <div className="eyebrow mb-2 mt-5">Ejercicio</div>
        <select className="field" value={exId} onChange={(e) => setExId(e.target.value)}>
          <option value="">Todos los ejercicios</option>
          {usedExercises.map((e) => (
            <option key={e!.id} value={e!.id}>
              {e!.name}
            </option>
          ))}
        </select>
        <div className="eyebrow mb-2 mt-5">Tipo de sesión</div>
        <select className="field" value={tpl} onChange={(e) => setTpl(e.target.value)}>
          <option value="todas">Todas</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value="libre">Libre / importadas</option>
        </select>
        {activeFilters > 0 && (
          <button className="btn-ghost mt-4 w-full" onClick={() => { setTpl('todas'); setExId(''); setPeriod('todo'); }}>
            Quitar filtros
          </button>
        )}
      </Sheet>
    </Page>
  );
}
