# Spec: Reducir border-radius en toda la app

## Objetivo
Bajar el radius general. La estética buscada es "libreta de cuentas"
— esquinas de papel, no la típica tarjeta de app genérica con todo
redondeado. Cambio puramente visual, sin tocar lógica ni tests.

## Escala nueva
Definir dos tokens en `index.css` con `@theme` (mismo mecanismo que ya
se usa para los colores):
```css
--radius-sm: 6px;   /* inputs, botones chicos, teclado, badges */
--radius-md: 10px;  /* tarjetas, botones grandes (Cargar gasto, Guardar) */
```

Reemplazar los valores actuales (que rondan 14px–20px, y varios
`rounded-full`) por estos dos, en:
- Tarjetas: Saldo, Ingresos, Gastos, Cerrar período → `--radius-md`.
- Botones grandes: "+ Cargar gasto", "Guardar gasto", "Cerrar período"
  → `--radius-md`.
- Inputs, botones del teclado numérico, botones de categoría, chips
  como "Fijo" → `--radius-sm`.

## Qué NO tocar
Los controles que son técnicamente un **toggle on/off** (el interruptor
de pausar un gasto fijo, si existe alguno con esa forma) se mantienen
con forma de píldora — es una convención de interacción reconocible,
no parte de la tendencia visual que se quiere sacar. El botón circular
"✕" de cerrar también se mantiene circular, por el mismo motivo.

## Verificación
Sin tests nuevos — es solo CSS. Revisar a mano que no haya quedado
ningún `rounded-full`, `rounded-xl` o `rounded-2xl` suelto que se haya
escapado del reemplazo.

## Criterio de aceptación
- `npm run test` sigue en verde (no debería haberse tocado ningún
  test), `npm run build` sin errores.
- Comparación visual: nada en la app debería verse tan redondeado como
  en las capturas anteriores a este cambio.
