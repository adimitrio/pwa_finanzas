# Spec: PWA instalable y offline

## Objetivo
Que el navegador ofrezca instalar la app, y que funcione sin conexión
una vez que se abrió al menos una vez. Los datos ya son locales
(Dexie/IndexedDB) — esto falta es el manifest y el service worker que
hacen que el propio código de la app también quede disponible offline.

## Dependencias a instalar
- `vite-plugin-pwa`

## Configuración: `vite.config.ts`
Agregar el plugin junto a los que ya están (`tailwindcss()`, `react()`):

```ts
import { VitePWA } from 'vite-plugin-pwa'

// dentro de plugins: [...]
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Finanzas',
    short_name: 'Finanzas',
    description: 'Gestión de finanzas personales, sin conexión',
    theme_color: '#1D1C1A',
    background_color: '#F3EFE6',
    display: 'standalone',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico}']
  }
})
```

Los colores (`#1D1C1A` oscuro, `#F3EFE6` papel) son los que ya usamos en
las pantallas — así la app se ve consistente en la barra de estado del
celular y en la pantalla de carga al abrirla instalada.

No hace falta escribir el `manifest.webmanifest` a mano ni registrar el
service worker manualmente — el plugin genera los dos y los inyecta en
`index.html` solo, respetando el `base` que se le pase en cada build
(GitHub Pages con `--base=/pwa_finanzas/`, VPS sin ese flag).

## Íconos
Crear `public/icon-192.png` y `public/icon-512.png`. No hace falta que
sean el diseño final — alcanza con un cuadrado de fondo `#1D1C1A` con
un signo "$" o similar en el acento dorado que ya usa la app, para que
la app sea instalable desde ya. Se pueden reemplazar después sin
volver a tocar este spec.

## Persistencia de datos
En `src/main.tsx` (o donde arranca la app), pedirle al navegador que no
borre los datos automáticamente:
```ts
if (navigator.storage?.persist) {
  navigator.storage.persist()
}
```
Envuelto en el `if` por las dudas — no todos los navegadores lo
soportan, y no tiene que romper nada si falta.

## Verificación (manual, no hay tests automáticos para esto)
Service worker y prompt de instalación no se pueden probar de forma
significativa con Vitest — la verificación es a mano, en el navegador:

1. `npm run build && npm run preview`, abrir la URL que muestra.
2. DevTools → **Application** → **Manifest**: tiene que mostrar el
   manifest sin errores, con los íconos cargando bien.
3. DevTools → **Application** → **Service Workers**: tiene que
   aparecer uno activo.
4. Recargar la página, después tildar **Offline** en la pestaña
   **Network** de DevTools, y volver a recargar: la app tiene que
   seguir funcionando (pantallas, carga de gastos, todo).
5. En el celular, después de haber publicado (GitHub Pages o VPS),
   confirmar que el navegador ofrece "Instalar app" o "Agregar a
   pantalla de inicio", y que abre en modo standalone (sin la barra de
   direcciones del navegador).

## Criterio de aceptación
- `npm run build` sigue compilando sin errores, ahora generando
  también el manifest y el service worker en `dist/`.
- Los 5 pasos de verificación manual de arriba, hechos a mano.

## Fuera de alcance
No hay pantalla de "actualización disponible" cuando se publica una
versión nueva — `registerType: 'autoUpdate'` actualiza en segundo
plano sin avisar. No se optimiza qué se precachea más allá de lo que
el plugin hace por defecto.
