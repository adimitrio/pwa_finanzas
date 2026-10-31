# Spec: Sacar el medio de pago

## Por qué
Los botones Efectivo / Débito / Crédito no aportan: son un toque de más
en la pantalla donde lo que importa es la velocidad. Se sacan de la
pantalla, del modelo y del CSV. (Cuando llegue tarjeta/cuotas, el medio
de pago se vuelve a pensar con su propio spec.)

## Diseño
Ya está actualizado en `specs/diseno/`: `CargarGasto.dc.html` y
`CargarGastoEditar.dc.html` sin la sección "Medio de pago", y las
listas de gastos de `Main.dc.html` / `InicioAbierto.dc.html` con solo la
fecha en la línea secundaria (antes `Débito · 2026-10-25`).
El resto del look no cambia.

## Cambios

### 1. Modelo (`src/db/schema.ts`)
- Borrar el tipo `MedioPago` y el campo `medioPago` de `Gasto`.
- NO subir la versión de Dexie ni tocar `stores`: `medioPago` no era
  índice. Los gastos ya guardados conservan la propiedad suelta; es
  inofensiva y no se migra (al editar un gasto, el `put` campo a campo
  ya la descarta).
- De paso, corregir el comentario de `version(2)`: dice que "fijo" es una
  etiqueta en `Gasto`, y eso ya no existe.

### 2. `src/components/CargarGasto.tsx`
Sacar: el import de `MedioPago`, `MEDIOS`, `MEDIO_LABELS`, el estado
`medioPago` y su reset, `medioPago` en el `put` y en el `add`, y la
sección JSX completa "Medio de pago". Todo lo demás queda igual
(categorías, descripción, teclado, fecha y "Eliminar gasto" en edición,
bloqueo con monto $0).

### 3. `src/components/Inicio.tsx`
- Cierre de período: sacar `medioPago: 'debito'` del gasto
  "Deuda mes anterior".
- Lista de gastos: la línea secundaria muestra solo `g.fecha` (sin el
  medio y sin `capitalize`).

### 4. CSV (`src/logic/exportarCsv.ts`)
Columnas nuevas, en este orden:
`fecha,monto,categoria,descripcion,periodo`
- Sin `medio_pago`.
- Sin `id`: el UUID no le sirve al otro sistema (ya se había pedido
  sacarlo y no quedó aplicado). Como el otro sistema reemplaza por
  período, no hace falta para evitar duplicados.
- El resto del contrato no cambia (monto con 2 decimales, RFC 4180,
  `\r\n`, UTF-8, filas por fecha ascendente, nombre de archivo).
- Actualizar `specs/exportar-gastos-csv.md` para que describa estas
  columnas.

### 5. Tests
- Sacar `medioPago` de todos los gastos de prueba en
  `schema.test.ts`, `Inicio.test.tsx`, `CargarGasto.test.tsx` y
  `exportarCsv.test.ts`, y del `toMatchObject` del cierre en
  `Inicio.test.tsx`.
- `exportarCsv.test.ts`: encabezado `fecha,monto,categoria,descripcion,periodo`
  y filas sin id ni medio (ej. `2026-09-15,4800.00,super,,Octubre 2026`).
- `CargarGasto.test.tsx`: agregar un test que verifique que en carga y en
  edición NO existe el grupo "Medio de pago"
  (`queryByRole('group', { name: 'Medio de pago' })` es `null`).

### 6. `AGENTS.md` (limpieza)
- Modelo de datos: borrar la frase sobre "Fijo" / `esFijo`; el modelo es
  `gastos`, `ingresos` y `periodos`, y `Gasto` no tiene concepto de fijo
  ni de medio de pago.
- Alcance del MVP, "Adentro": sacar "gastos fijos editables" y poner
  "editar y eliminar gastos, exportar CSV". Dejar "exportar/importar JSON
  como backup" (sigue pendiente).

## Criterio de aceptación
- `npm run test` en verde y `npm run build` sin errores.
- `grep -rniE "medioPago|MedioPago|medio_pago|MEDIOS" src` → 0
  resultados (solo puede aparecer el test que verifica que no existe el
  grupo "Medio de pago").
- Cargar gasto y Editar gasto no muestran "Medio de pago"; el teclado
  aprovecha el espacio libre y la pantalla no hace scroll en un
  teléfono chico.
- Un gasto nuevo en IndexedDB tiene solo `id`, `monto`, `categoria`,
  `fecha`, `descripcion?` y `actualizadoEn`.
- El CSV exportado no tiene columnas `id` ni `medio_pago`.

## Fuera de alcance
Migrar los datos viejos, editar los specs históricos (`cargar-gasto.md`,
`modelo-de-datos.md`, `periodos.md`, etc.), y cualquier cambio de look,
lógica de períodos o textos fuera de lo que lista este spec.
El agente NO hace push: lo hace Adrián.
