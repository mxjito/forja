/** Todos los pesos se guardan SIEMPRE en kg. La unidad elegida solo afecta a la visualización. */

export type Equipment = 'maquina' | 'barra' | 'mancuerna' | 'polea' | 'corporal' | 'otro';

export type Muscle =
  | 'pecho'
  | 'espalda'
  | 'hombro'
  | 'hombro_post'
  | 'biceps'
  | 'triceps'
  | 'antebrazo'
  | 'abdomen'
  | 'cuadriceps'
  | 'femoral'
  | 'gluteo'
  | 'pantorrilla';

export interface Exercise {
  id: string;
  name: string;
  /** Músculo principal primero. */
  muscles: Muscle[];
  equipment: Equipment;
  /** Ejercicio grande → descanso largo (regla 5). */
  compound: boolean;
  /** "Cómo hacerlo bien" del Excel. */
  tip: string;
  /** Aviso de seguridad (espalda baja, etc.). */
  caution?: string;
  /** Salto de peso para la progresión, en kg. */
  increment: number;
  /** Ejercicios que no se cuentan como volumen con peso (peso corporal). */
  bodyweight?: boolean;
  /** Ejercicio sin series × reps clásicas (wrist roller). */
  freeform?: boolean;
  /** Foto propia (de la máquina del gym) como data URL. */
  photo?: string;
  /** Objetivo personal de peso, en kg. */
  goalKg?: number;
  /** true si no está en ninguna rutina (ej. del programa anterior). */
  legacy?: boolean;
  custom?: boolean;
}

export interface TemplateItem {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** Texto original del Excel, ej. "3 × 10 por pierna". */
  repsLabel?: string;
  /** Peso inicial tal y como viene en el Excel ("40 kg", "A probar"). */
  startLabel: string;
  /** Peso inicial numérico si existe. */
  startKg?: number;
  restSec: number;
  /** Consigna específica de este día (si difiere de la del ejercicio). */
  tip?: string;
  /** Alternativas válidas (ej. hip thrust si duele la espalda baja). */
  alternatives?: string[];
}

export interface Template {
  id: string;
  name: string;
  short: string;
  /** Músculos trabajados, en texto corto. */
  focus: string;
  optional?: boolean;
  items: TemplateItem[];
  order: number;
}

export interface SetEntry {
  /** kg; null = no apuntado. */
  weight: number | null;
  /** null = desconocido (ej. historial importado sin reps). */
  reps: number | null;
  done: boolean;
  doneAt?: number;
  /** Récord conseguido en esta serie. */
  pr?: PRKind[];
}

export type PRKind = 'peso' | 'e1rm' | 'reps';

export interface SessionExercise {
  /** Clave única dentro de la sesión. */
  key: string;
  exerciseId: string;
  target: { sets: number; repMin: number; repMax: number; restSec: number; repsLabel?: string };
  sets: SetEntry[];
  note?: string;
  finished?: boolean;
}

export interface Session {
  id: string;
  templateId: string | null;
  name: string;
  startedAt: number;
  endedAt?: number;
  status: 'activa' | 'terminada';
  /** ms acumulados en pausa. */
  pausedMs: number;
  pausedAt?: number;
  exercises: SessionExercise[];
  note?: string;
  /** Sesión importada (programa anterior / texto). */
  imported?: boolean;
  /** Descanso en curso (timestamp de fin), para sobrevivir a recargas. */
  restEndsAt?: number;
  restTotal?: number;
  currentKey?: string;
}

export interface BodyWeight {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  kg: number;
  note?: string;
}

export interface Measurement {
  id: string;
  date: string;
  /** cm */
  cintura?: number;
  brazo?: number;
  pecho?: number;
  muslo?: number;
  otros?: string;
}

export type WeekPlan = Record<number, string | null>; // 0 = domingo … 6 = sábado

export type Accent = 'lima' | 'azul' | 'naranja' | 'violeta' | 'rosa';

export interface Settings {
  id: 'main';
  unit: 'kg' | 'lb';
  theme: 'oscuro' | 'claro' | 'sistema';
  accent: Accent;
  weekPlan: WeekPlan;
  restCompound: number;
  restIsolation: number;
  autoRest: boolean;
  sound: boolean;
  vibrate: boolean;
  keepAwake: boolean;
  heightCm?: number;
  goalWeightKg?: number;
  goalSessionsPerWeek: number;
  proteinMin: number;
  proteinMax: number;
  maintenanceKcal?: number;
  surplusKcal?: number;
  lastExportAt?: number;
  programStart?: string;
  seedVersion: number;
}
