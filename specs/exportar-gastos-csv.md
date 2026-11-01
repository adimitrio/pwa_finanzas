# Spec: Exportar gastos a CSV

> Hacer DESPUÉS de `sacar-es-fijo.md` (el CSV no incluye `esFijo`).

## Objetivo
Poder descargar los gastos de un período como archivo CSV, para que otro
sistema (seguimiento) los consuma. Funciona offline: todo se arma en el
navegador con lo que hay en IndexedDB, sin servidor.

## Contrato del CSV
El contrato vigente está en `specs/exportar-ingresos-csv.md` (incluye
ingresos y reemplaza columnas, nombre de archivo y UI de este spec).

## Lógica pura (`src/logic/exportarCsv.ts`)
- `gastosACsv(gastos: Gasto[], periodo: Periodo): string`
  - Filtra con `gastosDelPeriodo(gastos, periodo)` (ya incluye el día
    de `fechaFin`) y arma el CSV completo (encabezado + filas).
  - Si no hay gastos, devuelve solo el encabezado.
- `nombreArchivoCsv(periodo: Periodo): string`
  - `gastos-` + nombre del período en minúsculas, sin tildes y con
    espacios como guiones, + `.csv`. Ej.: `gastos-octubre-2026.csv`.
- `formatearMontoCsv(centavos: number): string` (exportada, para
  testearla sola).

## Descarga (`src/lib/descargar.ts`)
- `descargarArchivo(nombre: string, contenido: string, mime: string)`:
  crea un `Blob`, un `<a download>` temporal, lo clickea y hace
  `URL.revokeObjectURL`. Es la única parte con efectos: la UI la llama
  y los tests de componente la mockean.
- Para el CSV: mime `text/csv;charset=utf-8`. NO agregar BOM (rompe
  algunos parsers); si después se abre en Excel y las tildes salen mal,
  se revisa.

## UI (`Inicio.tsx`)
- Al final de Inicio, debajo de "Cerrar período", un botón secundario
  (estilo discreto, no compite con "Cerrar período"): "Exportar gastos".
- Al tocarlo se despliega un panel inline (no una pantalla nueva) con:
  - un `<select>` con todos los períodos, del más nuevo al más viejo
    (por `fechaInicio` descendente), preseleccionado el período actual;
  - el texto "N gastos" del período elegido;
  - el botón "Descargar CSV".
- Si el período elegido no tiene gastos: botón deshabilitado y el texto
  "Este período no tiene gastos".
- Cambiar el período del select actualiza el conteo en el momento.
- Sin pantalla de confirmación ni toast: el navegador ya muestra la
  descarga.
- Mantener el diseño vigente (tokens, Fraunces para números, radius
  reducido).

## Tests
- `exportarCsv.test.ts` (lógica pura, sin DOM):
  - encabezado exacto y orden de columnas;
  - una fila con todos los campos; descripción vacía queda vacía;
  - `formatearMontoCsv`: `100 → "1.00"`, `480000 → "4800.00"`,
    `4505000 → "45050.00"`, `5 → "0.05"`;
  - escapado: descripción con coma, con comillas y con salto de línea;
  - solo entran gastos del rango del período (incluye el día de
    `fechaFin`, excluye el día anterior a `fechaInicio` y el posterior
    a `fechaFin`);
  - orden por fecha ascendente;
  - período sin gastos → solo encabezado;
  - `nombreArchivoCsv('Octubre 2026')` → `gastos-octubre-2026.csv`, y
    con tildes (`Setiembre`/`Diciembre ñ`) sin acentos.
- `Inicio.test.tsx`:
  - el botón "Exportar gastos" abre el panel con el período actual
    preseleccionado;
  - cambiar el período cambia el conteo;
  - "Descargar CSV" llama a `descargarArchivo` (mockeada) con el nombre
    y contenido esperados;
  - período vacío → botón deshabilitado.

## AGENTS.md
Agregar una sección corta "Exportación CSV" que apunte a este contrato
(columnas, orden, formato de monto) y diga que cambiarlo requiere avisar.

## Criterio de aceptación
- `npm run test` en verde, `npm run build` sin errores.
- Desde el celular instalado como PWA y sin conexión, se descarga el
  CSV del período actual y del anterior.
- El archivo abierto en un editor de texto respeta exactamente el
  contrato de arriba.

## Fuera de alcance
- Exportar ingresos o períodos.
- Importar CSV / backup y restauración.
- JSON o TXT.
- Compartir con la hoja nativa del celular (`navigator.share`).
