# Spec: Períodos con cierre de caja

## Objetivo
Los períodos se basan en el ciclo de pago, no en el mes calendario. Un
período **empieza el día que cobrás** y dura hasta que cobrás de nuevo.
Cerrarlo ("Cobré") traslada el saldo final al período nuevo como un
ingreso o un gasto más — como cerrar caja: lo que sobra o falta es el
punto de partida del turno siguiente.

## Modelo mental
No hay `fechaFin` en ningún lado, ni estado de "vencido". Un período
dura hasta que el usuario toca "Cobré", momento en el que:
1. Se calcula el saldo final del período que se cierra, con la misma
   fórmula que ya se usa para mostrarlo en pantalla.
2. Se crea el período nuevo, con `fechaInicio` = hoy.
3. Ese saldo final se carga en el período nuevo como un `Ingreso`
   ("Saldo mes anterior") si es positivo o cero, o como un `Gasto`
   ("Deuda mes anterior") si es negativo. Nunca se guarda un número
   negativo suelto en ningún campo.

## Nota sobre datos de prueba
Como en el spec anterior: no hace falta migración de datos. Después de
implementar esto, borrá la base del navegador una vez: DevTools →
Application → IndexedDB → clic derecho en "finanzas" → Delete database.

## Cambio de schema (`src/db/schema.ts`) — migración `version(2)`
No editar `version(1)`, que ya corrió.

```ts
export interface Periodo {
  id: string
  fechaInicio: string   // 'YYYY-MM-DD', el día que se cobró
  nombre: string          // ej. 'Octubre 2026', lo elige el usuario
  actualizadoEn: number
}

export interface Ingreso {
  id: string
  periodoId: string      // antes: mes: string
  nombre: string           // 'Sueldo', 'Bono', 'Saldo mes anterior', etc.
  montoNeto: number       // centavos, siempre positivo
  actualizadoEn: number
}

export interface Gasto {
  id: string
  monto: number
  categoria: Categoria
  medioPago: MedioPago
  fecha: string
  periodoId: string       // nuevo. Se asigna al guardar, no se deriva de `fecha`
  descripcion?: string    // nuevo, opcional. Ej. 'Deuda mes anterior'
  actualizadoEn: number
}
```

```ts
// dentro de la clase FinanzasDB
periodos!: Table<Periodo, string>

// después de this.version(1).stores({...}) tal cual está:
this.version(2).stores({
  gastos: 'id, fecha, categoria, periodoId',
  gastosFijos: 'id, activo',
  ingresos: 'id, periodoId',
  periodos: 'id, fechaInicio'
})
```
`descripcion` en `Gasto` no necesita índice — no hace falta agregarlo a
la lista de `stores`, solo al `interface`. `periodoId` sí, porque se
usa para filtrar.

## Funciones puras: `src/logic/periodos.ts`

```ts
export interface PeriodoResumen { id: string; fechaInicio: string; nombre: string }

export function obtenerPeriodoActual(periodos: PeriodoResumen[]): PeriodoResumen | null {
  if (periodos.length === 0) return null
  return [...periodos].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))[0]
}

export type AsientoDeCierre =
  | { tipo: 'ingreso'; monto: number; nombre: string }
  | { tipo: 'gasto'; monto: number; descripcion: string }

export function calcularAsientoDeCierre(saldoFinal: number): AsientoDeCierre {
  if (saldoFinal >= 0) {
    return { tipo: 'ingreso', monto: saldoFinal, nombre: 'Saldo mes anterior' }
  }
  return { tipo: 'gasto', monto: Math.abs(saldoFinal), descripcion: 'Deuda mes anterior' }
}
```

### Tests: `src/logic/periodos.test.ts`
1. `obtenerPeriodoActual` devuelve el período con `fechaInicio` más
   reciente entre varios.
2. Sin períodos, devuelve `null`.
3. `calcularAsientoDeCierre` con saldo positivo devuelve
   `{ tipo: 'ingreso', nombre: 'Saldo mes anterior', monto: saldoFinal }`.
4. Con saldo exactamente en 0, también devuelve `tipo: 'ingreso'` (no
   `'gasto'`) — documentar este caso explícitamente en el test.
5. Con saldo negativo devuelve
   `{ tipo: 'gasto', descripcion: 'Deuda mes anterior', monto: Math.abs(saldoFinal) }`.

## No tocar `calcularSaldoDelMes`
Sigue igual, tal cual está. Lo que cambia es cómo se arman sus
argumentos: los ingresos y gastos que se le pasan son los del período
actual (`obtenerPeriodoActual`), filtrando `gastos` por
`periodoId === periodoActual.id` (con
`db.gastos.where('periodoId').equals(periodoActual.id)`) — no por
fecha. La fecha queda solo para mostrar cuándo pasó cada gasto, nunca
para decidir a qué período pertenece.

## Ajuste a `src/components/CargarGasto.tsx`
Al guardar, asignarle al `Gasto` el `periodoId` del período vigente en
ese momento exacto: `obtenerPeriodoActual(await db.periodos.toArray())`
adentro del handler de guardar (una consulta puntual alcanza, no hace
falta que sea reactivo con `useLiveQuery` acá). Esto es lo que evita que
un gasto cargado el mismo día de un cierre quede mezclado con el
período nuevo: si se carga antes de tocar "Cobré", toma el período
viejo; si se carga después, toma el nuevo.

Si todavía no existe ningún período (antes de crear el primero en
Inicio), el botón "Cargar gasto" en Inicio queda deshabilitado — no se
puede llegar a esta pantalla sin un período activo.

Sumar a `src/components/CargarGasto.test.tsx`: guardar un gasto le
asigna el `periodoId` del período actual.

## Componentes (`src/components/Inicio.tsx`)

**Botón "Cobré"**, visible junto a la sección de ingresos del período.
Al tocarlo:
1. Pide el nombre del período nuevo (input de texto, ej. "Octubre
   2026").
2. Muestra el saldo que se va a trasladar antes de confirmar (un
   `window.confirm` con el monto alcanza, sin modal propio).
3. Al confirmar, en una transacción de Dexie
   (`db.transaction('rw', db.periodos, db.ingresos, db.gastos, ...)`):
   crea el `Periodo` nuevo, y con `calcularAsientoDeCierre` crea el
   `Ingreso` o `Gasto` correspondiente en ese período nuevo, con su
   `periodoId`. Si es un `Gasto` (deuda), usa `categoria: 'otros'` y
   `medioPago: 'debito'` — son campos requeridos por el tipo, sin
   significado real para este asiento contable.
4. La pantalla pasa a mostrar el período nuevo automáticamente (usa
   `useLiveQuery`, no hace falta refetch manual).

**Sin períodos todavía (primera vez que se usa la app):** formulario
simple para crear el primero a mano — nombre + fecha de inicio. Sin
asiento de cierre automático, porque no hay período anterior. Si el
usuario quiere reflejar la plata que ya tiene disponible, la carga
después con el flujo normal de "agregar ingreso" (por ejemplo, con
nombre "Saldo inicial").

## Tests: sumar a `src/components/Inicio.test.tsx`
6. Tocar "Cobré" con saldo positivo crea un período nuevo y un ingreso
   "Saldo mes anterior" con el monto correcto adentro.
7. Tocar "Cobré" con saldo negativo crea un gasto "Deuda mes anterior"
   en el período nuevo, con `descripcion` seteada.
8. Después de "Cobré", el saldo mostrado en pantalla arranca en el
   valor trasladado, antes de cargar nada más.
9. Cargar un gasto, tocar "Cobré", y cargar otro gasto: el primero
   queda con el `periodoId` del período viejo y el segundo con el del
   nuevo, aunque los dos tengan la misma `fecha` (el caso del almuerzo
   el mismo día que cobrás).

## Criterio de aceptación
- `npm run test` en verde, `npm run build` sin errores.
- Cerrar un período con saldo negativo y volver a abrir la app muestra
  el nuevo período con la deuda ya reflejada en el saldo.

## Fuera de alcance
No hay forma de deshacer un cierre ya hecho. No hay vista de períodos
pasados ni historial — solo se ve el actual. "Últimos gastos" sigue sin
filtrarse por período, igual que antes. No se puede reabrir o editar un
período ya cerrado.
