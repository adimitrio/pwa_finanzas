# Spec: Sacar "Es fijo"

## Objetivo
Eliminar el concepto "fijo" de la app. Nunca llegó a tener ninguna
consecuencia (ni en el saldo ni en nada que se decida con él), así que
todo gasto vuelve a ser simplemente un gasto. Se mantiene `descripcion`.

## Schema (`src/db/schema.ts`)
- Quitar `esFijo: boolean` de la interfaz `Gasto`.
- NO agregar `version(3)` ni tocar `stores()`: el campo nunca estuvo
  indexado.
- NO migrar ni borrar datos. La base del navegador ya tiene datos
  reales de uso; los registros viejos conservan la propiedad `esFijo`
  sobrante, que es inofensiva y nadie lee. No hace falta borrar
  IndexedDB esta vez.

## `CargarGasto.tsx`
Sacar el toggle "Es fijo" y su texto de ayuda. Dejar el campo
"Descripción" tal cual. Verificar que la pantalla siga entrando sin
scroll.

## `Inicio.tsx`
- Sacar la subsección "Fijos" de la tarjeta "Gastos".
- Sacar la etiqueta "Fijo" de las filas de "Últimos".
- La tarjeta "Gastos" queda con la lista de últimos y sus acciones de
  editar y eliminar, sin cambios.

## Tests
- `CargarGasto.test.tsx`: sacar los tests que tildan "Es fijo".
- `Inicio.test.tsx`: sacar los tests de la subsección "Fijos" y de la
  etiqueta. El cálculo del saldo no cambia, no tocar `saldo.ts`.

## AGENTS.md
Si menciona `esFijo` o gastos fijos en alguna parte, sacarlo.

## Criterio de aceptación
- `npm run test` en verde, `npm run build` sin errores.
- Un gasto cargado antes de este cambio (con `esFijo` guardado) se
  sigue mostrando y editando sin errores.

## Fuera de alcance
No se borra ningún dato existente.
