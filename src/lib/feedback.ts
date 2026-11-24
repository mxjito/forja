let ctx: AudioContext | null = null;

/** Hay que llamarlo desde un gesto del usuario para que iOS permita el sonido después. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx?.state === 'suspended') ctx.resume();
  } catch {
    /* sin audio */
  }
}

export function beep(times = 3) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  for (let i = 0; i < times; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = i === times - 1 ? 1320 : 880;
    const t = t0 + i * 0.22;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.18);
  }
}

export function buzz(pattern: number | number[] = [180, 90, 180]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no soportado */
  }
}

/** Mantiene la pantalla encendida durante el entrenamiento (si el navegador lo permite). */
export function keepScreenOn(enabled: boolean) {
  let lock: WakeLockSentinel | null = null;
  let alive = true;
  const req = async () => {
    if (!enabled || !alive || document.visibilityState !== 'visible') return;
    try {
      lock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      /* denegado o no soportado */
    }
  };
  req();
  const vis = () => req();
  document.addEventListener('visibilitychange', vis);
  return () => {
    alive = false;
    document.removeEventListener('visibilitychange', vis);
    lock?.release().catch(() => {});
  };
}
