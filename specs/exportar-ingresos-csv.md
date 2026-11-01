# Spec: Exportar también los ingresos

## Objetivo
El CSV del período pasa a llevar los ingresos además de los gastos, en
el mismo archivo. Así el otro sistema recibe todo lo que mueve el saldo
del período y puede reconstruirlo: `sum(ingresos) − sum(gastos)`.
Sigue siendo 100 % offline: se arma en el navegador con lo que hay en
IndexedDB.

Este spec reemplaza el contrato de `specs/exportar-gastos-csv.md`
(columnas, nombre de archivo, UI). Lo demás de ese spec (formato de
monto, escapado, descarga sin servidor, sin BOM) sigue igual.

## Contrato del CSV (nuevo)
Un único archivo por período. Una fila por movimiento, primera fila =
encabezado. Columnas, en este orden:

`tipo,fecha,monto,categoria,descripcion,periodo`

- `tipo`: `ingreso` o `gasto`.
- `fecha`: 'YYYY-MM-DD'.
  - gasto: la fecha del gasto, tal cual está guardada.
  - ingreso: la `fechaInicio` del período (el día de cobro). Los
    ingresos no tienen fecha propia.
- `monto`: pesos con punto decimal y siempre 2 decimales (`4800.00`),
  sin separador de miles ni `$`. SIEMPRE positivo: el signo lo da
  `tipo`. Se calcula con enteros sobre los centavos (la
  `formatearMontoCsv` que ya existe), nunca con `c / 100`.
  - ingreso: `montoNeto`.
- `categoria`: el id guardado (`super`, `comida`, ...) en los gastos;
  vacía en los ingresos.
- `descripcion`:
  - gasto: la descripción; vacía si no tiene.
  - ingreso: el `nombre` del ingreso (`Sueldo`, `Bono`,
    `Saldo mes anterior`, ...).
- `periodo`: el `nombre` del período exportado (ej. `Octubre 2026`).

Igual que antes: separador coma, fin de línea `\r\n`, UTF-8 sin BOM,
escapado RFC 4180 (campo con coma, comilla doble o salto de línea va
entre comillas dobles y las internas se duplican).

Orden de filas: primero los ingresos (por `actualizadoEn` ascendente),
después los gastos por `fecha` ascendente.

Los traslados del cierre se exportan como cualquier otro movimiento: el
ingreso `Saldo mes anterior` y el gasto `Deuda mes anterior` se
distinguen por su `descripcion`. Así el CSV suma igual que el saldo de
la app.

Nombre de archivo: `movimientos-<nombre del período en minúsculas, sin
tildes, espacios como guiones>.csv`. Ej.: `movimientos-octubre-2026.csv`.

Ejemplo:
```
tipo,fecha,monto,categoria,descripcion,periodo
ingreso,2026-10-01,2350000.00,,Sueldo,Octubre 2026
ingreso,2026-10-01,100000.00,,Bono,Octubre 2026
gasto,2026-10-03,32450.00,super,Compra de la semana,Octubre 2026
gasto,2026-10-05,4800.00,comida,,Octubre 2026
```

## Lógica pura (`src/logic/exportarCsv.ts`)
- Reemplazar `gastosACsv` por
  `movimientosACsv(gastos: Gasto[], ingresos: Ingreso[], periodo: Periodo): string`.
  - Gastos: filtrar con `gastosDelPeriodo(gastos, periodo)` (incluye el
    día de `fechaFin`).
  - Ingresos: los que tengan `periodoId === periodo.id`.
  - Sin movimientos → devuelve solo el encabezado.
- `nombreArchivoCsv(periodo)` pasa a usar el prefijo `movimientos-`.
- `formatearMontoCsv` y el escapado no cambian.

## UI (`src/components/Inicio.tsx`)
El look no cambia, solo textos y la lógica del panel. Los `id` de los
elementos NO cambian (`btn-exportar-gastos`, `panel-exportar`,
`select-periodo-exportar`, `conteo-gastos-exportar`,
`btn-descargar-csv`).
- Título del botón: "Exportar gastos" → "Exportar ingresos y gastos".
- Leer todos los ingresos con `useLiveQuery(() => db.ingresos.toArray())`
  (igual que `todosLosGastos`) y pasarlos a `movimientosACsv`: el
  filtrado por período lo hace la función pura.
- Conteo del período elegido: `N ingresos y M gastos`, con singular
  cuando es 1 (`1 ingreso y 1 gasto`).
- Si el período no tiene ni ingresos ni gastos: botón deshabilitado y el
  texto "Este período no tiene movimientos". Con que tenga uno solo de
  los dos, el botón está habilitado (antes dependía de que hubiera
  gastos).
- `descargarCsv` llama a `movimientosACsv` y `nombreArchivoCsv`.

## Tests
- `exportarCsv.test.ts` (adaptar los existentes a la nueva firma):
  - encabezado exacto `tipo,fecha,monto,categoria,descripcion,periodo`;
  - fila de gasto: `gasto,2026-09-15,4800.00,super,,Octubre 2026`;
  - fila de ingreso: `ingreso,2026-09-01,2350000.00,,Sueldo,Octubre 2026`
    (fecha = `fechaInicio`, categoría vacía, descripción = nombre);
  - los ingresos de otro período no entran;
  - orden: ingresos primero, después gastos por fecha ascendente;
  - período con solo ingresos → encabezado + sus filas (no solo el
    encabezado);
  - período sin nada → solo encabezado;
  - escapado: nombre de ingreso con coma entra entre comillas;
  - `nombreArchivoCsv('Octubre 2026')` → `movimientos-octubre-2026.csv`,
    y con tildes / ñ sin acentos.
- `Inicio.test.tsx`:
  - el conteo muestra `N ingresos y M gastos` (con singular);
  - período con solo ingresos → botón habilitado;
  - período vacío → botón deshabilitado y "Este período no tiene
    movimientos";
  - "Descargar CSV" llama a `descargarArchivo` (mockeada) con nombre
    `movimientos-enero-2026.csv` y un contenido que incluye el
    encabezado nuevo y la fila del ingreso.

## Documentación
- En `specs/exportar-gastos-csv.md`, reemplazar la sección "Contrato
  del CSV" por una línea que diga que el contrato vigente está en
  `specs/exportar-ingresos-csv.md`.
- `AGENTS.md`: agregar una sección corta "Exportación CSV" (falta; el
  spec anterior la pedía) con las columnas, el orden, el formato de
  monto y la regla de que cambiar el contrato requiere avisar.

## Criterio de aceptación
- `npm run test` en verde, `npm run build` sin errores.
- Se descarga `movimientos-<período>.csv` y, abierto en un editor de
  texto, respeta exactamente el contrato de arriba.
- `suma(ingresos) − suma(gastos)` de las filas del CSV coincide con el
  saldo que muestra Inicio para ese período.
- `grep -rn "gastosACsv" src` → 0 resultados.

## Fuera de alcance
Importar CSV, backup JSON, exportar varios períodos juntos, y cambios de
look. El agente NO hace push: lo hace Adrián.
