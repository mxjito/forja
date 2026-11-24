// Prueba de extremo a extremo en tamaño móvil contra `vite preview`.
import { chromium, devices } from 'playwright';
const URL = process.env.URL ?? 'http://localhost:4173/';
const shots = 'tests/shots/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-ES', timezoneId: 'Europe/Paris' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
const step = async (name, fn) => { try { await fn(); console.log('✓', name); } catch (e) { console.log('✗', name, '\n   ', e.message.split('\n')[0]); errors.push(name); } };
const shot = (n) => page.screenshot({ path: shots + n + '.png', fullPage: false });

await step('inicio carga', async () => {
  await page.goto(URL);
  await page.getByText(/Hoy toca|Día de descanso/).waitFor();
  await shot('01-inicio');
  await page.screenshot({ path: shots + '01b-inicio-full.png', fullPage: true });
});
await step('service worker activo', async () => {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
});
await step('comenzar entrenamiento', async () => {
  await page.getByRole('button', { name: /Comenzar entrenamiento/i }).first().click();
  await page.locator('header').getByRole('button', { name: 'Terminar', exact: true }).waitFor();
  await shot('02-entreno');
});
await step('validar serie 1 con reps', async () => {
  const reps = page.getByLabel('Repeticiones serie 1').first();
  await reps.fill('8');
  await page.getByLabel('Validar serie 1').first().click();
  await page.getByText('Descanso', { exact: false }).last().waitFor();
  await page.waitForTimeout(400);
  await shot('03-descanso');
});
await step('persistencia tras recargar', async () => {
  await page.reload();
  await page.getByLabel('Desmarcar serie 1').first().waitFor();
  const t = await page.getByText(/^\d+:\d{2}$/).count();
  if (!t) throw new Error('temporizador de descanso no restaurado');
});
await step('saltar descanso y completar sets', async () => {
  await page.getByRole('button', { name: 'Saltar' }).click();
  // Serie 2 sin reps: debe usar la serie anterior de la sesión (8)
  await page.getByLabel('Validar serie 2').first().click();
  await page.getByRole('button', { name: 'Saltar' }).click();
  await page.getByLabel('Repeticiones serie 3').first().fill('7');
  await page.getByLabel('Validar serie 3').first().click();
  await page.getByRole('button', { name: 'Saltar' }).click();
  await page.waitForTimeout(800);
  await shot('04-ejercicio-hecho');
});
await step('pausa', async () => {
  await page.getByLabel('Pausar').click();
  await page.getByText('Entrenamiento en pausa').waitFor();
  await page.getByLabel('Reanudar').click();
});
await step('terminar y resumen', async () => {
  await page.locator('header').getByRole('button', { name: 'Terminar', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Terminar' }).click();
  await page.getByText('Entrenamiento guardado').waitFor();
  await shot('05-resumen');
  await page.getByRole('button', { name: 'Ver detalle' }).click();
  await page.getByText('Sentadilla con barra').first().waitFor();
  await shot('06-detalle');
});
await step('historial', async () => {
  await page.goto(URL + '#/historial');
  await page.getByText('Pierna 1').first().waitFor();
  await shot('07-historial');
});
await step('progreso', async () => {
  await page.goto(URL + '#/progreso');
  await page.getByText('Entrenamientos por semana').waitFor();
  await page.screenshot({ path: shots + '08-progreso.png', fullPage: true });
});
await step('ejercicio detalle con gráfica', async () => {
  await page.goto(URL + '#/ejercicio/press-pecho-maquina');
  await page.getByText('Evolución').waitFor();
  await page.screenshot({ path: shots + '09-ejercicio.png', fullPage: true });
});
await step('peso corporal: añadir', async () => {
  await page.goto(URL + '#/cuerpo');
  await page.getByLabel('Añadir peso').click();
  await page.getByLabel('Peso', { exact: true }).fill('80,6');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByText('Peso guardado').waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: shots + '10-cuerpo.png', fullPage: true });
});
await step('rutinas', async () => {
  await page.goto(URL + '#/rutinas');
  await page.getByText('Semana').first().waitFor();
  await page.screenshot({ path: shots + '11-rutinas.png', fullPage: true });
  await page.goto(URL + '#/rutinas/pierna-2');
  await page.getByText('Peso muerto rumano con mancuernas').first().waitFor();
  await page.screenshot({ path: shots + '12-rutina.png', fullPage: true });
});
await step('exportar', async () => {
  await page.goto(URL + '#/ajustes');
  const dl = page.waitForEvent('download');
  await page.getByText('Exportar copia de seguridad').click();
  const d = await dl;
  const p = await d.path();
  const json = JSON.parse(require_fs().readFileSync(p, 'utf8'));
  if (json.app !== 'forja' || json.data.sessions.length < 4) throw new Error('copia incompleta');
  await page.screenshot({ path: shots + '13-ajustes.png', fullPage: true });
});
await step('modo claro', async () => {
  await page.getByRole('button', { name: 'Claro' }).click();
  await page.goto(URL + '#/');
  await page.waitForTimeout(300);
  await shot('14-claro');
  await page.goto(URL + '#/ajustes');
  await page.getByRole('button', { name: 'Oscuro' }).click();
});
await step('funciona sin internet', async () => {
  await ctx.setOffline(true);
  await page.goto(URL);
  await page.getByText(/Buen trabajo|Hoy toca/).waitFor({ timeout: 8000 });
  await ctx.setOffline(false);
});
await step('manifest válido', async () => {
  const m = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  if (m.display !== 'standalone' || m.icons.length < 3) throw new Error('manifest incompleto');
});
console.log(errors.length ? '\nERRORES:\n' + errors.join('\n') : '\nSin errores');
await browser.close();
import { createRequire } from 'node:module';
function require_fs() { return createRequire(import.meta.url)('node:fs'); }
