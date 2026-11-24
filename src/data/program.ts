/**
 * Programa transcrito del Excel «Mi programa de gym – 4 días + brazos.xlsx»
 * (hojas: Cómo usarlo, Lun · Torso 1, Mar · Pierna 1, Jue · Torso 2, Vie · Pierna 2, Sáb · Brazos y abs).
 * Los textos de técnica son los de la columna «Cómo hacerlo bien», sin cambios.
 */
import type { Exercise, Session, Template, TemplateItem, WeekPlan, BodyWeight, SetEntry } from '../db/types';

const BIG = 150; // regla 5: 2–3 min en los grandes
const SMALL = 90; // regla 5: 1–1.5 min en los chicos

const ex = (e: Omit<Exercise, 'increment'> & { increment?: number }): Exercise => ({
  increment: e.increment ?? (e.equipment === 'mancuerna' ? 2 : 2.5),
  ...e,
});

export const EXERCISES: Exercise[] = [
  // ── Lunes · Torso 1
  ex({ id: 'press-pecho-maquina', name: 'Press de pecho en máquina', muscles: ['pecho', 'triceps', 'hombro'], equipment: 'maquina', compound: true,
    tip: 'Omóplatos atrás y pecho afuera. Baja hasta sentir que el pecho se estira. Empuja con el pecho, no con los hombros.' }),
  ex({ id: 'aperturas-maquina', name: 'Aperturas en máquina (pec deck)', muscles: ['pecho'], equipment: 'maquina', compound: false,
    tip: 'Abre hasta sentir el estiramiento del pecho. Junta las manos como si abrazaras un árbol y aprieta 1 segundo.' }),
  ex({ id: 'jalon-pecho', name: 'Jalón al pecho', muscles: ['espalda', 'biceps'], equipment: 'polea', compound: false,
    tip: 'Arriba, deja que los brazos se estiren del todo. Lleva los codos a las bolsas traseras del pantalón.' }),
  ex({ id: 'remo-mancuerna', name: 'Remo con mancuerna (apoyado en banco)', muscles: ['espalda', 'biceps'], equipment: 'mancuerna', compound: false,
    tip: 'Jala con el codo hacia la cadera; la mano es solo un gancho. Abajo deja que el hombro baje para estirar.',
    caution: 'Siempre apoyado en el banco para proteger la espalda baja.' }),
  ex({ id: 'laterales-mancuerna', name: 'Elevaciones laterales con mancuernas', muscles: ['hombro'], equipment: 'mancuerna', compound: false,
    tip: 'Sube con los codos, no con las manos. Inclínate un poco adelante. No subas los hombros a las orejas.' }),
  ex({ id: 'curl-mancuerna', name: 'Curl de bíceps con mancuernas', muscles: ['biceps'], equipment: 'mancuerna', compound: false,
    tip: 'Codos pegados, sin balanceo. Gira el meñique hacia el hombro y baja hasta estirar el brazo completo.' }),
  ex({ id: 'extension-triceps-sentado', name: 'Extensión de tríceps sobre la cabeza, sentado', muscles: ['triceps'], equipment: 'mancuerna', compound: false,
    tip: 'Baja la mancuerna detrás de la cabeza hasta estirar bien. Codos al frente.' }),

  // ── Martes · Pierna 1
  ex({ id: 'sentadilla', name: 'Sentadilla con barra', muscles: ['cuadriceps', 'gluteo'], equipment: 'barra', compound: true,
    tip: 'Pecho arriba, rodillas en la dirección de los pies. Baja hasta paralelo o más: la sentadilla profunda hace crecer más glúteos.' }),
  ex({ id: 'prensa', name: 'Prensa de piernas', muscles: ['cuadriceps', 'gluteo'], equipment: 'maquina', compound: true,
    tip: 'Baja hondo sin que la espalda baja se despegue del respaldo. No bloquees las rodillas arriba.' }),
  ex({ id: 'curl-femoral-sentado', name: 'Curl femoral SENTADO', muscles: ['femoral'], equipment: 'maquina', compound: false,
    tip: 'Sentado, no acostado: hace crecer más el femoral. Baja lento, en 3 segundos.' }),
  ex({ id: 'extension-cuadriceps', name: 'Extensión de cuádriceps', muscles: ['cuadriceps'], equipment: 'maquina', compound: false,
    tip: 'Aprieta 1 segundo arriba y baja controlado hasta abajo del todo.' }),
  ex({ id: 'pantorrillas-pie', name: 'Pantorrillas DE PIE (máquina o Smith)', muscles: ['pantorrilla'], equipment: 'maquina', compound: false,
    tip: 'De pie, rodillas estiradas: crecen mucho más que sentado. Pausa 2 s abajo estirando.' }),
  ex({ id: 'crunch-declinado', name: 'Crunch en banco declinado', muscles: ['abdomen'], equipment: 'corporal', compound: false, bodyweight: true, increment: 2.5,
    tip: 'Enrolla solo la parte alta de la espalda; la espalda baja se queda en el banco. Luego con disco en el pecho.' }),

  // ── Jueves · Torso 2
  ex({ id: 'press-inclinado-maquina', name: 'Press inclinado en máquina (o en Smith, ~30°)', muscles: ['pecho', 'hombro', 'triceps'], equipment: 'maquina', compound: true,
    tip: 'Para la parte de ARRIBA del pecho. Omóplatos atrás, baja hasta sentir el estiramiento.' }),
  ex({ id: 'fondos', name: 'Fondos (dips)', muscles: ['pecho', 'triceps', 'hombro'], equipment: 'corporal', compound: true, bodyweight: true, increment: 2.5,
    tip: 'Inclínate adelante para pecho. Baja hasta brazos a 90°. Si no sacas 5, usa la máquina asistida. Si duele el hombro, no bajes tanto.' }),
  ex({ id: 'remo-polea-sentado', name: 'Remo en polea sentado', muscles: ['espalda', 'biceps'], equipment: 'polea', compound: false,
    tip: 'Deja que los brazos se estiren adelante, luego pecho afuera y jala al ombligo. Junta omóplatos 1 s.' }),
  ex({ id: 'jalon-cerrado', name: 'Jalón agarre cerrado (o dominadas)', muscles: ['espalda', 'biceps'], equipment: 'polea', compound: false,
    tip: 'Estira del todo arriba. Lleva la barra al pecho con los codos hacia abajo, sin echarte atrás.' }),
  ex({ id: 'laterales-polea', name: 'Elevaciones laterales en polea (un brazo)', muscles: ['hombro'], equipment: 'polea', compound: false,
    tip: 'Polea abajo, cable por delante del cuerpo. La polea mantiene la tensión abajo, donde la mancuerna no.' }),
  ex({ id: 'skull-crusher', name: 'Skull crusher con barra Z', muscles: ['triceps'], equipment: 'barra', compound: false,
    tip: 'Baja la barra un poco detrás de la cabeza para estirar más. Codos fijos apuntando al techo.' }),
  ex({ id: 'curl-martillo', name: 'Curl martillo', muscles: ['biceps', 'antebrazo'], equipment: 'mancuerna', compound: false,
    tip: 'Pulgares arriba todo el tiempo. Trabaja bíceps, braquial y antebrazo: el brazo se ve más grueso.' }),

  // ── Viernes · Pierna 2
  ex({ id: 'peso-muerto-rumano', name: 'Peso muerto rumano con mancuernas', muscles: ['femoral', 'gluteo'], equipment: 'mancuerna', compound: true,
    tip: 'Espalda recta, cadera atrás hasta estirar femorales.',
    caution: 'SOLO si la espalda baja no duele. Si duele: hip thrust en máquina.' }),
  ex({ id: 'hip-thrust-maquina', name: 'Hip thrust en máquina', muscles: ['gluteo', 'femoral'], equipment: 'maquina', compound: true,
    tip: 'Alternativa al peso muerto rumano cuando duele la espalda baja.' }),
  ex({ id: 'zancadas', name: 'Zancadas con mancuernas', muscles: ['cuadriceps', 'gluteo'], equipment: 'mancuerna', compound: false,
    tip: 'Paso largo, la rodilla de atrás casi toca el suelo. Glúteo y cuádriceps.' }),
  ex({ id: 'crunch-maquina', name: 'Crunch en máquina', muscles: ['abdomen'], equipment: 'maquina', compound: false,
    tip: 'Enrolla el torso acercando costillas a cadera. No jales con los brazos. Sube el peso como en cualquier músculo.' }),

  // ── Sábado · Brazos y abs
  ex({ id: 'pajaros-maquina', name: 'Pájaros en máquina (pec deck al revés)', muscles: ['hombro_post'], equipment: 'maquina', compound: false,
    tip: 'Para la parte de ATRÁS del hombro, que casi nadie entrena. Brazos casi estirados, abre hacia atrás.' }),
  ex({ id: 'extension-polea-cuerda', name: 'Extensión en polea sobre la cabeza (cuerda)', muscles: ['triceps'], equipment: 'polea', compound: false,
    tip: 'De espaldas a la polea. Empuja adelante y arriba; regresa lento hasta estirar.' }),
  ex({ id: 'curl-predicador', name: 'Curl predicador (banco Scott)', muscles: ['biceps'], equipment: 'barra', compound: false,
    tip: 'Brazo apoyado. Baja hasta casi estirar del todo: esa parte de abajo es la que más hace crecer.' }),
  ex({ id: 'curl-muneca', name: 'Curl de muñeca (palmas arriba)', muscles: ['antebrazo'], equipment: 'mancuerna', compound: false,
    tip: 'Deja rodar el peso hasta la punta de los dedos y sube la muñeca al máximo.' }),
  ex({ id: 'curl-muneca-inverso', name: 'Curl de muñeca inverso (palmas abajo)', muscles: ['antebrazo'], equipment: 'mancuerna', compound: false,
    tip: 'Hazlo justo después del curl normal, sin descanso.' }),
  ex({ id: 'wrist-roller', name: 'Wrist roller', muscles: ['antebrazo'], equipment: 'otro', compound: false, freeform: true, increment: 2.5,
    tip: 'Brazos estirados al frente. Enrolla la cuerda y desenrolla lento.' }),
  ex({ id: 'elevaciones-colgado', name: 'Elevaciones de piernas colgado', muscles: ['abdomen'], equipment: 'corporal', compound: false, bodyweight: true, increment: 2.5,
    tip: 'Alternativa al crunch declinado (sábado).',
    caution: 'Solo si la espalda baja no duele.' }),
  ex({ id: 'dominadas', name: 'Dominadas', muscles: ['espalda', 'biceps'], equipment: 'corporal', compound: false, bodyweight: true, increment: 2.5,
    tip: 'Alternativa al jalón agarre cerrado (jueves).' }),

  // ── Programa anterior (historial del 21 y 23 nov): se conservan para no perder el historial.
  ex({ id: 'press-banca-mancuernas', name: 'Press de banca con mancuernas', muscles: ['pecho', 'triceps', 'hombro'], equipment: 'mancuerna', compound: true, legacy: true,
    tip: 'Fuera del programa actual: no hace sentir el pecho. El press de pecho en máquina lo sustituye.' }),
  ex({ id: 'press-militar-mancuernas', name: 'Press militar con mancuernas', muscles: ['hombro', 'triceps'], equipment: 'mancuerna', compound: true, legacy: true,
    tip: 'Del programa anterior.' }),
  ex({ id: 'crunch-polea', name: 'Crunch en polea con cuerda', muscles: ['abdomen'], equipment: 'polea', compound: false, legacy: true,
    tip: 'Fuera del programa: lastimaba el meñique. Sustituido por crunch declinado o en máquina.' }),
];

const it = (exerciseId: string, sets: number, repMin: number, repMax: number, startLabel: string, restSec: number, extra: Partial<TemplateItem> = {}): TemplateItem => {
  const m = startLabel.match(/(\d+(?:[.,]\d+)?)/);
  return { exerciseId, sets, repMin, repMax, startLabel, startKg: m ? parseFloat(m[1].replace(',', '.')) : undefined, restSec, ...extra };
};

export const TEMPLATES: Template[] = [
  {
    id: 'torso-1', name: 'Torso 1', short: 'T1', order: 1, focus: 'Pecho, espalda, hombro, brazos',
    items: [
      it('press-pecho-maquina', 3, 8, 10, '40 kg', BIG),
      it('aperturas-maquina', 3, 12, 15, 'A probar', SMALL),
      it('jalon-pecho', 3, 8, 10, '45–50 kg', SMALL),
      it('remo-mancuerna', 3, 8, 10, '22 kg', SMALL),
      it('laterales-mancuerna', 3, 12, 15, '6 kg', SMALL),
      it('curl-mancuerna', 3, 10, 12, '12 kg', SMALL),
      it('extension-triceps-sentado', 3, 10, 12, '14 kg', SMALL),
    ],
  },
  {
    id: 'pierna-1', name: 'Pierna 1', short: 'P1', order: 2, focus: 'Cuádriceps, femoral, glúteo, pantorrilla, abdomen',
    items: [
      it('sentadilla', 3, 6, 8, '60 kg', BIG),
      it('prensa', 3, 10, 12, 'A probar', BIG),
      it('curl-femoral-sentado', 3, 10, 12, 'A probar', SMALL),
      it('extension-cuadriceps', 3, 12, 15, 'A probar', SMALL),
      it('pantorrillas-pie', 3, 12, 15, 'A probar', SMALL),
      it('crunch-declinado', 3, 12, 15, 'Sin peso', SMALL),
    ],
  },
  {
    id: 'torso-2', name: 'Torso 2', short: 'T2', order: 3, focus: 'Pecho, espalda, hombro, brazos',
    items: [
      it('press-inclinado-maquina', 3, 8, 10, 'A probar', BIG),
      it('fondos', 3, 6, 10, 'Peso corporal', BIG),
      it('remo-polea-sentado', 3, 10, 12, 'A probar', SMALL),
      it('jalon-cerrado', 3, 8, 10, 'A probar', SMALL, { alternatives: ['dominadas'] }),
      it('laterales-polea', 3, 12, 15, 'A probar', SMALL),
      it('skull-crusher', 3, 10, 12, '20 kg', SMALL),
      it('curl-martillo', 3, 10, 12, '12 kg', SMALL),
    ],
  },
  {
    id: 'pierna-2', name: 'Pierna 2', short: 'P2', order: 4, focus: 'Cuádriceps, femoral, glúteo, pantorrilla, abdomen',
    items: [
      it('prensa', 3, 8, 10, 'A probar', BIG, { tip: 'Aquí va más pesado que el martes. Baja hondo y controlado, sin despegar la espalda baja.' }),
      it('peso-muerto-rumano', 3, 8, 10, 'A probar (ligero)', BIG, { alternatives: ['hip-thrust-maquina'] }),
      it('zancadas', 3, 10, 10, 'A probar', SMALL, { repsLabel: '3 × 10 por pierna' }),
      it('curl-femoral-sentado', 3, 12, 12, 'A probar', SMALL, { tip: 'Baja lento, en 3 segundos, hasta estirar del todo.' }),
      it('pantorrillas-pie', 3, 15, 15, 'A probar', SMALL, { tip: 'De pie o en la prensa. Rodillas estiradas. Pausa abajo estirando, sube lo más alto posible.' }),
      it('crunch-maquina', 3, 12, 15, 'A probar', SMALL),
    ],
  },
  {
    id: 'brazos-abs', name: 'Brazos y abs', short: 'BA', order: 5, optional: true, focus: 'Hombro posterior, brazos, antebrazos, abdomen',
    items: [
      it('pajaros-maquina', 3, 12, 15, 'A probar', SMALL),
      it('laterales-mancuerna', 3, 15, 15, '6 kg', SMALL, { tip: 'Tercer día de hombro lateral: es lo que te hace ver ancho.' }),
      it('extension-polea-cuerda', 3, 12, 15, '7.5–10 kg', SMALL),
      it('curl-predicador', 3, 10, 12, 'A probar', SMALL),
      it('curl-muneca', 3, 15, 15, '10 kg', 0, { tip: 'Deja rodar el peso hasta la punta de los dedos y sube la muñeca al máximo. Seguido, sin descanso, el curl inverso.' }),
      it('curl-muneca-inverso', 3, 15, 15, '6 kg', SMALL),
      it('wrist-roller', 3, 1, 1, '2.5–5 kg', SMALL, { repsLabel: '2–3 subidas y bajadas' }),
      it('crunch-declinado', 3, 12, 15, 'Sin peso o disco', SMALL, { alternatives: ['elevaciones-colgado'], tip: 'Crunch declinado o elevaciones de piernas colgado. Elevaciones colgado solo si la espalda baja no duele.' }),
    ],
  },
];

/** 0 = domingo. Hoja «Cómo usarlo». */
export const WEEK_PLAN: WeekPlan = { 0: null, 1: 'torso-1', 2: 'pierna-1', 3: null, 4: 'torso-2', 5: 'pierna-2', 6: 'brazos-abs' };

export const REST_NOTES: Record<number, string> = {
  3: 'Descanso. Caminar o cardio suave si quieres.',
  0: 'Descanso.',
};

export const RULES: string[] = [
  'Cada serie casi al fallo: que solo te queden 1 o 2 reps en el tanque.',
  'Cuando hagas el máximo de reps en TODAS las series con buena técnica, súbele: 2.5 kg o la siguiente mancuerna.',
  'Si no llegas al mínimo de reps, bájale al peso.',
  'Baja el peso despacio, en 2–3 segundos. Ahí está el crecimiento.',
  'Descansa 2–3 min en los ejercicios grandes (sentadilla, prensa, press) y 1–1.5 min en los chicos.',
  'Calienta 5–10 min y haz una serie ligera antes del primer ejercicio.',
  'Apunta cada sesión: la app lo hace por ti, serie por serie.',
  'Si un músculo todavía te duele mucho, baja el peso o quita 1 serie de ese músculo.',
  'Espalda baja con dolor: nada de peso muerto rumano ni elevaciones colgado ese día.',
  'Proteína 140–170 g al día, unas 300 kcal arriba de mantenimiento, y dormir 7–9 horas.',
  'Sigue este programa 3–4 meses. Se cambia si te estancas 2–3 semanas seguidas.',
  'Cada músculo recibe unas 9–15 series fuertes por semana, repartidas en 2–3 días: es el rango que mejor funciona en los estudios.',
];

// ── Historial real (texto del usuario). Las reps que no se apuntaron quedan como desconocidas (null).
const s = (weight: number | null, reps: number | null): SetEntry => ({ weight, reps, done: true });
const at = (iso: string) => new Date(iso).getTime();

export const HISTORY: Session[] = [
  {
    id: 'hist-2026-11-21-a', templateId: null, name: 'Cuerpo completo (programa anterior)', status: 'terminada', imported: true,
    startedAt: at('2026-11-21T11:00:00'), endedAt: at('2026-11-21T12:00:00'), pausedMs: 0,
    note: 'Importado. Solo se apuntó el peso; series y reps no registradas.',
    exercises: [
      { key: 'a1', exerciseId: 'sentadilla', target: { sets: 1, repMin: 0, repMax: 0, restSec: BIG }, sets: [s(60, null)], note: '~60 kg (40 kg de discos + barra)' },
      { key: 'a2', exerciseId: 'press-banca-mancuernas', target: { sets: 1, repMin: 0, repMax: 0, restSec: BIG }, sets: [s(22, null)], note: '22 kg por mano' },
      { key: 'a3', exerciseId: 'remo-mancuerna', target: { sets: 1, repMin: 0, repMax: 0, restSec: SMALL }, sets: [s(20, null)] },
      { key: 'a4', exerciseId: 'press-militar-mancuernas', target: { sets: 1, repMin: 0, repMax: 0, restSec: SMALL }, sets: [s(10, null)] },
      { key: 'a5', exerciseId: 'curl-mancuerna', target: { sets: 1, repMin: 0, repMax: 0, restSec: SMALL }, sets: [s(12, null)] },
      { key: 'a6', exerciseId: 'crunch-polea', target: { sets: 1, repMin: 0, repMax: 0, restSec: SMALL }, sets: [s(22.5, null)] },
    ],
  },
  {
    id: 'hist-2026-11-21-b', templateId: null, name: 'Tríceps, antebrazos y abs', status: 'terminada', imported: true,
    startedAt: at('2026-11-21T20:00:00'), endedAt: at('2026-11-21T20:45:00'), pausedMs: 0,
    note: 'Importado. Solo se apuntó el peso; series y reps no registradas.',
    exercises: [
      { key: 'b1', exerciseId: 'extension-triceps-sentado', target: { sets: 1, repMin: 0, repMax: 0, restSec: SMALL }, sets: [s(14, null)] },
      { key: 'b2', exerciseId: 'skull-crusher', target: { sets: 1, repMin: 0, repMax: 0, restSec: SMALL }, sets: [s(20, null)] },
      { key: 'b3', exerciseId: 'extension-polea-cuerda', target: { sets: 2, repMin: 0, repMax: 0, restSec: SMALL }, sets: [s(7.5, null), s(10, null)], note: '7.5–10 kg' },
      { key: 'b4', exerciseId: 'curl-muneca', target: { sets: 1, repMin: 0, repMax: 0, restSec: 0 }, sets: [s(10, null)] },
      { key: 'b5', exerciseId: 'curl-muneca-inverso', target: { sets: 1, repMin: 0, repMax: 0, restSec: SMALL }, sets: [s(6, null)] },
    ],
  },
  {
    id: 'hist-2026-11-23', templateId: 'torso-1', name: 'Torso 1', status: 'terminada', imported: true,
    startedAt: at('2026-11-23T18:00:00'), endedAt: at('2026-11-23T19:15:00'), pausedMs: 0,
    note: 'Importado del texto. Donde no se apuntaron las reps quedan vacías.',
    exercises: [
      { key: 'c1', exerciseId: 'press-banca-mancuernas', target: { sets: 2, repMin: 0, repMax: 0, restSec: BIG }, sets: [s(24, 8), s(24, 6)], note: '24 kg por mano' },
      { key: 'c2', exerciseId: 'remo-mancuerna', target: { sets: 3, repMin: 8, repMax: 10, restSec: SMALL }, sets: [s(20, null)] },
      { key: 'c3', exerciseId: 'jalon-pecho', target: { sets: 3, repMin: 8, repMax: 10, restSec: SMALL }, sets: [s(45, null), s(45, null), s(45, null)], note: '3 × 8–10 (reps exactas no apuntadas)' },
      { key: 'c4', exerciseId: 'curl-mancuerna', target: { sets: 3, repMin: 10, repMax: 12, restSec: SMALL }, sets: [s(12, 8), s(12, 8), s(12, 8)], note: 'Con 14 kg solo salían 7 reps a medias.' },
      { key: 'c5', exerciseId: 'laterales-mancuerna', target: { sets: 3, repMin: 12, repMax: 15, restSec: SMALL }, sets: [s(6, 12)] },
      { key: 'c6', exerciseId: 'press-pecho-maquina', target: { sets: 3, repMin: 8, repMax: 10, restSec: BIG }, sets: [s(35, 12), s(35, 12), s(35, 12)] },
    ],
  },
];

export const BODYWEIGHT: BodyWeight[] = [{ id: 'bw-2026-11-21', date: '2026-11-21', kg: 80, note: 'Peso de partida' }];
