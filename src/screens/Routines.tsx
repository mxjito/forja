import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, BookOpen } from 'lucide-react';
import { Page, Section, Sheet } from '../components/ui';
import { useExercises, useSettings, useTemplates, saveSettings } from '../lib/hooks';
import { DAY_NAMES, WEEK_ORDER } from '../lib/dates';
import { RULES, REST_NOTES } from '../data/program';
import { db, uid } from '../db/db';
import { estimateMinutes } from './Home';
import { useNavigate } from 'react-router-dom';

export default function Routines() {
  const templates = useTemplates() ?? [];
  const settings = useSettings();
  const exercises = useExercises();
  const nav = useNavigate();
  const [editDay, setEditDay] = useState<number | null>(null);
  const [rules, setRules] = useState(false);
  const today = new Date().getDay();

  const newTemplate = async () => {
    const id = uid('t-');
    await db.templates.add({ id, name: 'Nueva rutina', short: 'NR', focus: '', items: [], order: templates.length + 1 });
    nav(`/rutinas/${id}?editar=1`);
  };

  return (
    <Page title="Rutinas" subtitle="Programa 4 días + brazos">
      <Section title="Semana" action={<span className="text-xs text-mute">Toca un día para cambiarlo</span>}>
        <div className="card divide-hair">
          {WEEK_ORDER.map((d) => {
            const t = templates.find((x) => x.id === settings.weekPlan[d]);
            return (
              <button key={d} onClick={() => setEditDay(d)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-raised">
                <span className={`w-[84px] shrink-0 text-[15px] ${d === today ? 'font-semibold text-accent' : 'text-sub'}`}>{DAY_NAMES[d]}</span>
                <span className={`flex-1 truncate text-[15px] ${t ? 'font-medium' : 'text-mute'}`}>
                  {t ? t.name : REST_NOTES[d] ? 'Descanso' : 'Descanso'}
                  {t?.optional && <span className="ml-2 text-xs font-normal text-mute">opcional</span>}
                </span>
                <ChevronRight size={18} className="text-mute" />
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Entrenamientos" action={<button className="text-sm text-accent" onClick={newTemplate}><Plus size={14} className="inline -mt-0.5" /> Nueva</button>}>
        <div className="space-y-3">
          {templates.map((t) => {
            const days = WEEK_ORDER.filter((d) => settings.weekPlan[d] === t.id);
            const sets = t.items.reduce((a, i) => a + i.sets, 0);
            return (
              <Link key={t.id} to={`/rutinas/${t.id}`} className="card block p-4 active:opacity-80">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-raised text-[13px] font-bold text-sub">{t.short}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[17px] font-semibold">{t.name}</span>
                      <span className="shrink-0 text-xs text-mute">{days.map((d) => DAY_NAMES[d].slice(0, 3)).join(' · ') || 'sin día'}</span>
                    </div>
                    <div className="text-[13px] text-sub">{t.focus}</div>
                    <div className="mt-2 text-[13px] text-mute tnum">
                      {t.items.length} ejercicios · {sets} series · ~{estimateMinutes(t)} min
                    </div>
                    <div className="mt-2 line-clamp-2 text-[13px] text-sub/90">{t.items.map((i) => exercises.get(i.exerciseId)?.name).join(' · ')}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section>
        <button className="card flex w-full items-center gap-3 p-4 text-left" onClick={() => setRules(true)}>
          <BookOpen size={20} className="text-accent" />
          <span className="flex-1">
            <span className="block font-medium">Las reglas del programa</span>
            <span className="block text-[13px] text-sub">Progresión, descansos, nutrición</span>
          </span>
          <ChevronRight size={18} className="text-mute" />
        </button>
      </Section>

      <Sheet open={editDay != null} onClose={() => setEditDay(null)} title={editDay != null ? DAY_NAMES[editDay] : ''}>
        <div className="card divide-hair">
          {[{ id: null as string | null, name: 'Descanso' }, ...templates].map((t) => (
            <button
              key={t.id ?? 'rest'}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-raised"
              onClick={async () => {
                if (editDay == null) return;
                await saveSettings({ weekPlan: { ...settings.weekPlan, [editDay]: t.id } });
                setEditDay(null);
              }}
            >
              <span className="text-[15px]">{t.name}</span>
              {editDay != null && settings.weekPlan[editDay] === t.id && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={rules} onClose={() => setRules(false)} title="Las reglas">
        <ol className="space-y-4">
          {RULES.map((r, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-5 shrink-0 pt-0.5 text-sm font-semibold text-accent tnum">{i + 1}</span>
              <span className="text-[15px] leading-relaxed">{r}</span>
            </li>
          ))}
        </ol>
      </Sheet>
    </Page>
  );
}
