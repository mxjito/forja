import { useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, History, Home as HomeIcon, LineChart, Play, Scale } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { UIProvider, useToast } from './components/ui';
import { useActive, useApplyTheme, useNow, useSettings } from './lib/hooks';
import { requestPersistence } from './db/db';
import { formatDuration } from './lib/dates';
import { sessionDuration } from './lib/calc';
import Home from './screens/Home';
import Routines from './screens/Routines';
import TemplateDetail from './screens/TemplateDetail';
import ExerciseDetail from './screens/ExerciseDetail';
import Workout from './screens/Workout';
import HistoryScreen from './screens/History';
import SessionDetail from './screens/SessionDetail';
import Compare from './screens/Compare';
import Progress from './screens/Progress';
import Body from './screens/Body';
import SettingsScreen from './screens/Settings';

const TABS = [
  { to: '/', label: 'Inicio', icon: HomeIcon },
  { to: '/rutinas', label: 'Rutinas', icon: CalendarDays },
  { to: '/historial', label: 'Historial', icon: History },
  { to: '/progreso', label: 'Progreso', icon: LineChart },
  { to: '/cuerpo', label: 'Cuerpo', icon: Scale },
];

function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 safe-bottom" style={{ background: 'rgb(var(--bg) / 0.86)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', boxShadow: 'inset 0 1px 0 rgb(var(--line) / var(--line-a))' }}>
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex h-[58px] flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors ${isActive ? 'text-accent' : 'text-mute'}`}>
            {({ isActive }) => (
              <>
                <Icon size={23} strokeWidth={isActive ? 2.3 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Barra flotante para volver a la sesión en curso desde cualquier pantalla. */
function ActiveBar() {
  const active = useActive();
  const nav = useNavigate();
  const now = useNow(1000, !!active);
  if (!active) return null;
  const done = active.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  const total = active.exercises.reduce((a, e) => a + e.sets.length, 0);
  return (
    <button onClick={() => nav('/entreno')} className="fixed inset-x-3 z-40 mx-auto flex max-w-lg items-center gap-3 rounded-2xl bg-accent px-4 py-3 text-left text-onaccent shadow-2xl anim-rise" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 66px)' }}>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-onaccent/10">
        <Play size={18} fill="currentColor" />
      </span>
      <span className="flex-1">
        <span className="block text-[15px] font-semibold leading-tight">{active.name}</span>
        <span className="block text-xs opacity-75 tnum">
          {active.pausedAt ? 'En pausa' : 'En curso'} · {formatDuration(sessionDuration(active, now))} · {done}/{total} series
        </span>
      </span>
      <span className="text-sm font-semibold">Volver</span>
    </button>
  );
}

function UpdatePrompt() {
  const toast = useToast();
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Busca actualizaciones cada hora mientras la app está abierta.
      if (reg) setInterval(() => reg.update().catch(() => {}), 3600_000);
    },
  });
  useEffect(() => {
    if (offlineReady) {
      toast('Lista para usar sin internet');
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady, toast]);
  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-[65] mx-auto flex max-w-lg items-center gap-3 rounded-2xl bg-raised p-3 pl-4 shadow-2xl anim-rise safe-top" style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--line) / 0.1), 0 12px 32px rgb(0 0 0 / .4)' }}>
      <span className="flex-1 text-sm">
        <b className="block">Nueva versión disponible</b>
        <span className="text-sub">Tus datos se conservan.</span>
      </span>
      <button className="btn h-10 bg-accent px-4 text-sm text-onaccent" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </button>
    </div>
  );
}

/** Muestra en pantalla cualquier error inesperado en vez de fallar en silencio. */
function ErrorReporter() {
  const toast = useToast();
  useEffect(() => {
    const show = (msg: unknown) => toast(`Error: ${String(msg).slice(0, 140)}`);
    const onErr = (e: ErrorEvent) => show(e.message);
    const onRej = (e: PromiseRejectionEvent) => show((e.reason as Error)?.message ?? e.reason);
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, [toast]);
  return null;
}

function Shell() {
  const settings = useSettings();
  useApplyTheme(settings);
  const loc = useLocation();
  const inWorkout = loc.pathname.startsWith('/entreno');
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    requestPersistence();
  }, []);
  return (
    <>
      <div className="mx-auto max-w-lg">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rutinas" element={<Routines />} />
          <Route path="/rutinas/:id" element={<TemplateDetail />} />
          <Route path="/ejercicio/:id" element={<ExerciseDetail />} />
          <Route path="/entreno" element={<Workout />} />
          <Route path="/historial" element={<HistoryScreen />} />
          <Route path="/historial/:id" element={<SessionDetail />} />
          <Route path="/comparar" element={<Compare />} />
          <Route path="/progreso" element={<Progress />} />
          <Route path="/cuerpo" element={<Body />} />
          <Route path="/ajustes" element={<SettingsScreen />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
      {!inWorkout && <ActiveBar />}
      {!inWorkout && <TabBar />}
      <UpdatePrompt />
      <ErrorReporter />
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <UIProvider>
        <Shell />
      </UIProvider>
    </HashRouter>
  );
}

