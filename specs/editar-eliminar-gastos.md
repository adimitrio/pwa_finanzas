# Spec: Editar y eliminar gastos

## Contexto
`gastos-editables.md` quedó viejo (hablaba de "gastos fijos", que ya no
existen) y la funcionalidad nunca llegó al código: hoy la tarjeta
"Gastos" de `Inicio.tsx` solo lista, sin ninguna acción. Este spec lo
reemplaza. Para ingresos no se toca nada (ya se pueden eliminar; editarlos
es otro spec).

## Objetivo
Poder corregir un error de carga: cambiar monto, categoría, medio de
pago, descripción o fecha de un gasto ya guardado, o borrarlo.

## Diseño
Reusar la pantalla `CargarGasto` en "modo edición" en vez de crear un
formulario nuevo: mismo teclado, mismas categorías, cero UI duplicada.

### `CargarGasto.tsx`
- Props: `{ gasto?: Gasto; onVolver: () => void }`. Modo edición =
  `gasto !== undefined`. Sin `gasto` el componente se comporta
  exactamente igual que hoy.
- En modo edición el estado inicial sale del gasto: `pesos =
  gasto.monto / 100`, `categoria`, `medioPago`, `descripcion`
  (`gasto.descripcion ?? ''`) y `fecha`.
- Fecha: en modo edición, un `<input type="date" id="input-fecha"
  aria-label="Fecha">` compacto en el encabezado, a la derecha (espejo
  del ✕). Es obligatoria: si queda vacía, "Guardar cambios" queda
  deshabilitado. En modo carga NO se muestra (sigue siendo hoy).
- Botón principal: "Guardar cambios" en modo edición (el texto de
  confirmación "✓ Guardado" y el timer de vuelta son los mismos).
  Deshabilitado mientras `guardado` sea true.
- Guardar en modo edición NO usa `add`: arma el objeto completo
  explícitamente y hace `db.gastos.put({ id: gasto.id, monto: pesos *
  100, categoria, medioPago, fecha, ...(texto ? { descripcion: texto }
  : {}), actualizadoEn: Date.now() })`. Arma el objeto campo por campo
  (sin spread del gasto viejo): así, si se borra la descripción, el campo
  desaparece, y los registros viejos pierden cualquier propiedad
  sobrante.
- Botón "Eliminar gasto" (solo en modo edición): debajo de "Guardar
  cambios", estilo texto en rojo, alto táctil mínimo de 40px. Hace
  `window.confirm('¿Eliminar este gasto?')`; si confirma,
  `db.gastos.delete(gasto.id)` y `onVolver()` enseguida (sin timer); si
  cancela, no pasa nada.
- La pantalla tiene que seguir entrando sin scroll vertical: el teclado
  (`flex-1 min-h-36`) es lo que cede alto.

### `Inicio.tsx`
- Nueva prop `onEditarGasto: (gasto: Gasto) => void`.
- Cada fila de la lista de gastos pasa a ser un `<button>` de ancho
  completo (alto mínimo 44px) que llama a `onEditarGasto(g)`. El
  `aria-label` incluye categoría y monto, ej. "Editar gasto super
  $4.800".
- Mostrar la descripción en la fila, debajo de la categoría, si existe:
  ayuda a reconocer el gasto.
- La lista deja de cortarse en 10: muestra TODOS los gastos del período,
  porque si no un error viejo no se puede corregir. Se ordena por
  `fecha` descendente y, a igual fecha, por `actualizadoEn` descendente
  (así, editar un gasto no lo manda al tope de la lista). El subtítulo
  "Últimos" pasa a "Del período".
- No hay botones de eliminar en las filas: borrar solo se hace desde la
  pantalla de edición (evita borrar sin querer al desplazarse).

### `App.tsx`
- Agregar la pantalla de edición: guarda qué gasto se está editando y
  renderiza `<CargarGasto gasto={...} onVolver={...} />`. Al volver
  siempre se regresa a Inicio.

## Comportamientos a tener en cuenta
- Si se cambia la fecha a una que cae en otro período, el gasto sale de
  la lista del período actual y del saldo (el cálculo ya es por rango de
  fechas). Es lo esperado.
- Los gastos que crea el cierre ("Deuda mes anterior") se editan y
  eliminan como cualquier otro. No se protegen.
- `schema.ts` no se toca. No hay deshacer ni historial de ediciones.

## Tests
`CargarGasto.test.tsx` (modo edición):
1. Precarga monto, categoría, medio, descripción y fecha del gasto.
2. Cambiar el monto y guardar actualiza el registro existente: misma
   cantidad de gastos en la base, mismo `id`, `actualizadoEn` mayor.
3. Borrar la descripción y guardar deja el registro sin esa propiedad.
4. Cambiar la fecha y guardar persiste la fecha nueva.
5. Con la fecha vacía, "Guardar cambios" está deshabilitado.
6. "Eliminar gasto" con `window.confirm` en true borra el registro y
   llama a `onVolver`; en false no borra ni navega.
7. Modo carga sin `gasto`: no aparece el campo de fecha ni "Eliminar
   gasto" (los tests de hoy siguen pasando sin cambios).

`Inicio.test.tsx`:
8. Tocar una fila llama a `onEditarGasto` con ese gasto.
9. Con más de 10 gastos en el período, se listan todos.
10. El orden es por fecha descendente.
11. Tras editar el monto de un gasto, el saldo mostrado se recalcula sin
    recargar (ya hay `useLiveQuery`).
12. Tras eliminar un gasto, desaparece de la lista y del saldo.

## Criterio de aceptación
- `npm run test` en verde, `npm run build` sin errores.
- Desde el celular: abrir Inicio → Gastos → tocar un gasto → cambiar el
  monto → "Guardar cambios" → volver a Inicio con el saldo ya
  recalculado.
- Desde el celular: tocar un gasto → "Eliminar gasto" → confirmar → el
  gasto no está más y el saldo se corrigió.
- La pantalla de edición no hace scroll en un teléfono chico.

## Fuera de alcance
- Editar ingresos.
- Elegir otra fecha al cargar un gasto nuevo.
- Deshacer, historial de cambios, filtros o búsqueda.
