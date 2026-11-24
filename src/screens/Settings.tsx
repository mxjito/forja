import { useEffect, useRef, useState } from 'react';
import { Download, Upload, ShieldCheck, Smartphone, Info, RotateCcw } from 'lucide-react';
import { Page, Section, Segmented, Toggle, NumInput, useConfirm, useToast } from '../components/ui';
import { saveSettings, useSettings, useUnit } from '../lib/hooks';
import { exportBackup, restoreBackup, summarize, validateBackup } from '../lib/backup';
import { relativeDay, formatDuration } from '../lib/dates';
import { db } from '../db/db';
import type { Accent } from '../db/types';
import { fromUnit, roundDisplay, toUnit } from '../lib/units';

const ACCENTS: { id: Accent; label: string; dark: string }[] = [
  { id: 'lima', label: 'Lima', dark: 'rgb(200 240 74)' },
  { id: 'azul', label: 'Azul', dark: 'rgb(92 160 255)' },
  { id: 'naranja', label: 'Naranja', dark: 'rgb(255 146 72)' },
  { id: 'violeta', label: 'Violeta', dark: 'rgb(170 148 255)' },
  { id: 'rosa', label: 'Rosa', dark: 'rgb(255 102 146)' },
];

export default function SettingsScreen() {
  const s = useSettings();
  const { unit } = useUnit();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
    navigator.storage?.estimate?.().then((e) => e.usage != null && setUsage(`${(e.usage / 1024 / 1024).toFixed(1).replace('.', ',')} MB`)).catch(() => {});
  }, []);

  const doExport = async () => {
    const r = await exportBackup();
    if (r !== 'cancelado') toast(r === 'compartido' ? 'Copia compartida' : 'Copia descargada');
  };

  const doImport = async (f?: File) => {
    if (!f) return;
    try {
      const data = validateBackup(JSON.parse(await f.text()));
      const ok = await confirm({ title: 'Restaurar copia', body: `Contiene ${summarize(data)}. Sustituirá TODOS los datos actuales de este teléfono.`, confirm: 'Restaurar', danger: true });
      if (!ok) return;
      await restoreBackup(data);
      toast('Datos restaurados');
    } catch (e) {
      toast(e instanceof SyntaxError ? 'El archivo no es un JSON válido' : (e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const reset = async () => {
    const ok = await confirm({ title: 'Borrar todos los datos', body: 'Se eliminarán entrenamientos, pesadas y cambios en las rutinas, y se volverá al programa original. Exporta antes una copia.', confirm: 'Borrar todo', danger: true });
    if (!ok) return;
    await db.delete();
    location.reload();
  };

  return (
    <Page back title="Ajustes">
      <Section title="Apariencia">
        <div className="card space-y-4 p-4">
          <Segmented value={s.theme} onChange={(v) => saveSettings({ theme: v })} options={[{ value: 'oscuro', label: 'Oscuro' }, { value: 'claro', label: 'Claro' }, { value: 'sistema', label: 'Sistema' }]} />
          <div>
            <div className="eyebrow mb-2">Color de acento</div>
            <div className="flex gap-3">
              {ACCENTS.map((a) => (
                <button key={a.id} aria-label={a.label} onClick={() => saveSettings({ accent: a.id })} className={`h-10 w-10 rounded-full transition-transform ${s.accent === a.id ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}`} style={{ background: a.dark }} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Unidades">
        <div className="card p-4">
          <Segmented value={s.unit} onChange={(v) => saveSettings({ unit: v })} options={[{ value: 'kg', label: 'Kilogramos (kg)' }, { value: 'lb', label: 'Libras (lb)' }]} />
          <p className="mt-2 text-xs text-mute">Los datos se guardan siempre en kg; cambiar la unidad no altera tu historial.</p>
        </div>
      </Section>

      <Section title="Entrenamiento">
        <div className="card divide-hair">
          <SwitchRow label="Descanso automático" sub="Arranca el temporizador al validar una serie" checked={s.autoRest} onChange={(v) => saveSettings({ autoRest: v })} />
          <SwitchRow label="Sonido al acabar el descanso" checked={s.sound} onChange={(v) => saveSettings({ sound: v })} />
          <SwitchRow label="Vibración" sub="Solo en teléfonos compatibles (Android)" checked={s.vibrate} onChange={(v) => saveSettings({ vibrate: v })} />
          <SwitchRow label="Pantalla siempre encendida" sub="Durante el entrenamiento" checked={s.keepAwake} onChange={(v) => saveSettings({ keepAwake: v })} />
          <RestRow label="Descanso por defecto · grandes" value={s.restCompound} onChange={(v) => saveSettings({ restCompound: v })} />
          <RestRow label="Descanso por defecto · chicos" value={s.restIsolation} onChange={(v) => saveSettings({ restIsolation: v })} />
        </div>
        <p className="mt-2 px-1 text-xs text-mute">Los descansos por defecto se usan al añadir ejercicios nuevos. Los de tu programa se editan en cada rutina.</p>
      </Section>

      <Section title="Objetivos">
        <div className="card divide-hair">
          <NumRow label="Entrenamientos por semana" value={s.goalSessionsPerWeek} decimal={false} onChange={(v) => v && v > 0 && v <= 14 && saveSettings({ goalSessionsPerWeek: v })} />
          <NumRow label={`Peso objetivo (${unit})`} value={s.goalWeightKg != null ? roundDisplay(toUnit(s.goalWeightKg, unit), unit) : null} placeholder="—" onChange={(v) => saveSettings({ goalWeightKg: v == null || v === 0 ? undefined : fromUnit(v, unit) })} />
          <NumRow label="Altura (cm)" value={s.heightCm ?? null} decimal={false} onChange={(v) => saveSettings({ heightCm: v ?? undefined })} />
          <NumRow label="Proteína mín. (g/día)" value={s.proteinMin} decimal={false} onChange={(v) => v != null && saveSettings({ proteinMin: v })} />
          <NumRow label="Proteína máx. (g/día)" value={s.proteinMax} decimal={false} onChange={(v) => v != null && saveSettings({ proteinMax: v })} />
          <NumRow label="Mantenimiento (kcal)" value={s.maintenanceKcal ?? null} decimal={false} onChange={(v) => saveSettings({ maintenanceKcal: v ?? undefined })} />
          <NumRow label="Superávit (kcal)" value={s.surplusKcal ?? null} decimal={false} onChange={(v) => saveSettings({ surplusKcal: v ?? undefined })} />
        </div>
        {s.maintenanceKcal != null && (
          <p className="mt-2 px-1 text-[13px] text-sub">
            Objetivo diario: <b className="text-ink tnum">{(s.maintenanceKcal + (s.surplusKcal ?? 0)).toLocaleString('es-ES')} kcal</b> · <b className="text-ink tnum">{s.proteinMin}–{s.proteinMax} g</b> de proteína · dormir 7–9 h.
          </p>
        )}
      </Section>

      <Section title="Tus datos">
        <div className="card divide-hair">
          <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-raised" onClick={doExport}>
            <Download size={19} className="text-accent" />
            <span className="flex-1">
              <span className="block text-[15px]">Exportar copia de seguridad</span>
              <span className="block text-[13px] text-sub">{s.lastExportAt ? `Última: ${relativeDay(s.lastExportAt).toLowerCase()}` : 'Nunca exportado'} · archivo JSON</span>
            </span>
          </button>
          <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-raised" onClick={() => fileRef.current?.click()}>
            <Upload size={19} className="text-accent" />
            <span className="flex-1">
              <span className="block text-[15px]">Importar / restaurar</span>
              <span className="block text-[13px] text-sub">Desde un archivo exportado de Forja</span>
            </span>
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => doImport(e.target.files?.[0])} />
          <div className="flex items-start gap-3 px-4 py-3.5">
            <ShieldCheck size={19} className={persisted ? 'text-good' : 'text-mute'} />
            <span className="flex-1 text-[13px] text-sub">
              <span className="block text-[15px] text-ink">Almacenamiento {persisted ? 'persistente' : 'estándar'}</span>
              Tus datos se guardan en este teléfono (IndexedDB){usage ? `, ${usage} usados` : ''}. No hay sincronización en la nube: exporta una copia de vez en cuando y guárdala en Drive, iCloud o el correo.
              {!persisted && ' Instalar la app en la pantalla de inicio reduce el riesgo de que el navegador borre los datos.'}
            </span>
          </div>
        </div>
      </Section>

      <Section title="Aplicación">
        <div className="card divide-hair">
          <div className="flex items-start gap-3 px-4 py-3.5">
            <Smartphone size={19} className={standalone ? 'text-good' : 'text-mute'} />
            <span className="flex-1 text-[13px] text-sub">
              <span className="block text-[15px] text-ink">{standalone ? 'Instalada' : 'Instalar en el teléfono'}</span>
              {standalone ? 'Funciona sin internet.' : 'Android (Chrome): menú ⋮ → «Instalar aplicación». iPhone (Safari): botón Compartir → «Añadir a pantalla de inicio».'}
            </span>
          </div>
          <div className="flex items-start gap-3 px-4 py-3.5">
            <Info size={19} className="text-mute" />
            <span className="flex-1 text-[13px] text-sub">
              <span className="block text-[15px] text-ink">Forja {__APP_VERSION__}</span>
              Programa: «Mi programa de gym – 4 días + brazos».
            </span>
          </div>
          <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-bad active:bg-raised" onClick={reset}>
            <RotateCcw size={19} />
            <span className="text-[15px]">Borrar todos los datos</span>
          </button>
        </div>
      </Section>
    </Page>
  );
}

function SwitchRow({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex-1">
        <span className="block text-[15px]">{label}</span>
        {sub && <span className="block text-[13px] text-sub">{sub}</span>}
      </span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function NumRow({ label, value, onChange, decimal = true, placeholder }: { label: string; value: number | null; onChange: (v: number | null) => void; decimal?: boolean; placeholder?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <span className="flex-1 text-[15px]">{label}</span>
      <NumInput ariaLabel={label} value={value} onChange={onChange} decimal={decimal} placeholder={placeholder} className="!h-10 !w-24" />
    </div>
  );
}

function RestRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const opts = [60, 75, 90, 120, 150, 180];
  return (
    <div className="px-4 py-3">
      <div className="mb-2 text-[15px]">{label}</div>
      <div className="grid grid-cols-6 gap-1.5">
        {opts.map((o) => (
          <button key={o} className={`btn h-9 text-[13px] tnum ${value === o ? 'bg-accent text-onaccent' : 'bg-raised'}`} onClick={() => onChange(o)}>
            {formatDuration(o * 1000)}
          </button>
        ))}
      </div>
    </div>
  );
}
