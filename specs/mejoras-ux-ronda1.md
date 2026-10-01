# Spec: Mejoras UX/UI — ronda 1

## Objetivo
Cuatro cambios de alto valor y bajo riesgo: corregir un bug real en el
feedback de guardado, y restaurar la identidad visual (tipografía,
colores) que se había definido en los mockups originales pero no se
trasladó al código. Sin tocar datos ni lógica de negocio.

## 1. Bug: el feedback de "Guardado" nunca se ve
En `CargarGasto.tsx`, al guardar, `setGuardado(true)` y `onVolver()` se
llaman en el mismo tick — el componente se desmonta antes de que React
pinte el estado "✓ Guardado". Arreglarlo: mostrar la confirmación un
instante antes de navegar, con un `setTimeout` corto (~600ms) entre
`setGuardado(true)` y la llamada a `onVolver()`.

### Test a actualizar en `CargarGasto.test.tsx`
El test que verifica el llamado a `onVolver()` después de guardar tiene
que usar temporizadores falsos (`vi.useFakeTimers()`, avanzar con
`vi.advanceTimersByTime(600)`) en vez de esperar que se llame al toque.
Sumar un test nuevo: inmediatamente después de guardar (antes de
avanzar el timer), el texto "✓ Guardado" está en pantalla.

## 2. Tipografía y tokens de color exactos
Importar las fuentes en `index.html` (mismo enfoque que los mockups
originales):
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
```

En `index.css`, con `@theme` de Tailwind v4, definir los tokens exactos
en vez de usar clases genéricas (`stone-800`, `amber-400`,
`#f5f0e8`):
- Fondo general: `#F3EFE6`
- Tarjetas oscuras (Saldo): `#1D1C1A`
- Acento dorado: `#C9A24D` (no amarillo chillón)
- Borde sutil en tarjetas claras: `#E5DFD3`

Aplicar Fraunces + `font-variant-numeric: tabular-nums` al saldo
grande y al monto del teclado numérico. IBM Plex Sans para el resto
del texto.

Sin test automático para esto — es visual. Verificación manual: abrir
la app y comparar contra los mockups originales del canvas.

## 3. Cargar gasto sin scroll vertical
Contenedor de `CargarGasto.tsx` a `h-dvh` (o `h-svh`), `flex flex-col
justify-between`, con paddings verticales reducidos. Todo el flujo
(monto, categorías, medio de pago, teclado, botón guardar) tiene que
entrar en el viewport sin scrollear, en un teléfono chico.

Verificación manual: Chrome DevTools → Toggle device toolbar → un
modelo chico (ej. iPhone SE) → confirmar que "Guardar gasto" es
visible sin scrollear.

## 4. Tecla "00" en el teclado numérico
En el hueco vacío de la fila inferior del teclado (hoy un `<div></div>`
vacío a la izquierda del "0"), agregar un botón "00" que agrega esos
dos dígitos al monto, respetando el límite de longitud que ya existe.

### Test a sumar en `CargarGasto.test.tsx`
Tocar "5", "00", "00" muestra "50.000".

## Criterio de aceptación
- `npm run test` en verde, `npm run build` sin errores.
- Los dos puntos de verificación manual (feedback de guardado visible,
  sin scroll en pantallas chicas) confirmados a mano.

## Fuera de alcance (quedan para la ronda 2 y 3)
Hit-box del botón "✕", desglose de saldo en 3 columnas, íconos en
"Últimos gastos", diferenciar visualmente "Cerrar período", separador
de miles en los inputs de ingreso/fijos, toggle de gastos fijos más
accesible, fechas relativas, soporte de teclado físico.
