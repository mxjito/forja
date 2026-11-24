# Forja: app de entrenamiento (PWA)

Mi programa «4 días + brazos» como app instalable en el móvil. Funciona sin internet.

## Uso diario
- **Inicio**: qué toca hoy según el día, botón «Comenzar entrenamiento», resumen, regularidad.
- **Entreno**: apunta peso y reps de cada serie (se guarda al instante), muestra lo que hiciste la última vez,
  sugiere subir/bajar peso (reglas 2 y 3), temporizador de descanso, pausa, récords.
- **Rutinas**: plan semanal y rutinas editables (series, reps, descanso, consignas, orden).
- **Historial**: filtros, detalle editable, comparar dos sesiones.
- **Progreso**: volumen y entrenamientos por semana, series por músculo (9–15), récords, gráficas por ejercicio.
- **Cuerpo**: peso con tendencia suavizada y medidas.

## Datos
Todo se guarda en el teléfono (IndexedDB). **No hay sincronización en la nube**:
Ajustes → «Exportar copia de seguridad» genera un JSON; «Importar / restaurar» lo recupera.

## Desarrollo
```bash
npm install
npm run dev        # servidor local (accesible desde el móvil en la misma wifi)
npm test           # pruebas de la lógica
npm run build && npm run preview
node tests/e2e.mjs # prueba completa en Chromium tamaño móvil (con preview arrancado)
```
El programa original está en `src/data/program.ts` (transcrito del Excel).

## Publicar (GitHub Pages)
1. Crea un repositorio en GitHub y sube este proyecto a la rama `main`.
2. En el repo: Settings → Pages → Source: **GitHub Actions**.
3. Cada push a `main` publica en `https://<usuario>.github.io/<repo>/`.
4. Abre esa URL en el móvil → «Instalar aplicación» / «Añadir a pantalla de inicio».
