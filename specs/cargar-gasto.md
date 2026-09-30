# Spec: Pantalla de cargar gasto

## Objetivo
La pantalla principal (por ahora la única) de la app: cargar un gasto en
pocos toques y guardarlo en Dexie, usando el modelo de `src/db/schema.ts`.

## Referencia visual
Teclado numérico propio, categorías en grid, medio de pago como selector
de 3 opciones. Fondo tono papel, números grandes. (No hay archivo de
diseño adjunto — usar criterio propio de layout mobile-first con Tailwind,
manteniendo la lógica de interacción de abajo.)

## Dependencias a instalar
- `tailwindcss` con su plugin de Vite (versión más reciente)
- `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` (dev) —
  configurar Vitest con `environment: 'jsdom'` para los tests de
  componentes, sin afectar los tests ya existentes de `schema.test.ts`
  (esos son lógica pura, no necesitan DOM)

## Componente: `src/components/CargarGasto.tsx`
Reemplaza el contenido actual de `App.tsx` (por ahora es la única pantalla
de la app).

**Monto:** se arma tocando dígitos (no es un `<input>` de texto libre),
igual que un teclado numérico propio. Se muestra formateado con puntos de
miles. Internamente son centavos: lo que el usuario ve como "1.500" son
150000 centavos.

**Categoría:** grid de botones, una opción por cada valor del tipo
`Categoria` (`super`, `comida`, `transporte`, `salud`, `hogar`, `ocio`,
`otros`). Una sola seleccionada a la vez, default `otros`.

**Medio de pago:** selector de 3 opciones (`efectivo`, `debito`,
`credito`), default `debito`.

**Fecha:** hoy (`new Date().toISOString().slice(0, 10)`), fija por ahora —
no editable en esta pantalla todavía.

**Guardar:** crea un `Gasto` con `id: crypto.randomUUID()` y
`actualizadoEn: Date.now()`, lo guarda con `db.gastos.add(...)`, y
resetea el formulario a sus valores por defecto (monto en 0, categoría
`otros`, medio de pago `debito`).

## Tests: `src/components/CargarGasto.test.tsx`
1. Tocar los dígitos "1","5","0","0" arma el monto mostrado como "1.500".
2. Elegir una categoría distinta a la default la deja marcada como activa.
3. Al guardar, `db.gastos.add` se llama con un objeto donde `monto` es un
   entero en centavos (`150000` para "1.500", no `1500` ni `1500.00`).
4. Después de guardar, el monto en pantalla vuelve a "0".

## Criterio de aceptación
- `npm run test` corre en verde (incluye los tests viejos de `schema.test.ts`
  y los nuevos).
- `npm run build` sin errores de TypeScript.
- Cargar "1500" y guardar dos veces seguidas crea dos registros distintos
  en `gastos` (dos `id` distintos), no pisa el mismo.

## Fuera de alcance
No armar la pantalla de saldo/inicio. No hay navegación entre pantallas
todavía — esta es la única. No editar fecha ni medio de pago con más
opciones que las ya definidas. No tocar `schema.ts`.
