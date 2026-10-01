# Spec: Unificar gastos — todo es un `Gasto`

## Objetivo
Eliminar `GastoFijo` como tabla separada con descuento automático.
"Fijo" pasa a ser solo una etiqueta (`esFijo: boolean`) en un `Gasto`
común, cargado a mano como cualquier otro. Motivo: un gasto "fijo"
como la luz varía de monto y de fecha cada vez — un descuento
automático con un número inventado sería incorrecto.

## Cambio de schema (`src/db/schema.ts`)
Seguimos en desarrollo (sin datos reales que dependan de la migración
anterior), así que se ajusta `version(2)` en el lugar, no se agrega
`version(3)`.

- **Quitar `GastoFijo` por completo**: la interfaz, la tabla
  `gastosFijos!: Table<...>`, y su entrada en `stores()`.
- **Agregar a `Gasto`**: `esFijo: boolean` (default `false` al cargar
  desde `CargarGasto`). No hace falta indexarlo — con el volumen de
  datos de esta app alcanza con filtrar en memoria.

```ts
export interface Gasto {
  id: string
  monto: number
  categoria: Categoria
  medioPago: MedioPago
  fecha: string
  esFijo: boolean        // nuevo
  descripcion?: string
  actualizadoEn: number
}
```

## Simplificar `calcularSaldoDelMes` (`src/logic/saldo.ts`)
Ya no recibe gastos fijos por separado — todo es `gastos`:

```ts
export function calcularSaldoDelMes(
  ingresoNeto: number,
  gastosDelPeriodo: { monto: number }[]
): number {
  const total = gastosDelPeriodo.reduce((acc, g) => acc + g.monto, 0)
  return ingresoNeto - total
}
```

### Tests: reescribir `src/logic/saldo.test.ts`
Sacar los casos de "gasto fijo activo/inactivo" (ya no existe ese
concepto). Dejar:
1. Sin gastos, saldo = ingreso.
2. Con gastos, saldo = ingreso − suma de gastos.
3. Si los gastos superan el ingreso, el saldo da negativo.

## `CargarGasto.tsx`
Sumar dos campos (compacto, sin romper el "sin scroll" de la ronda 1
de UX — ver mockup `CargarGastoFijo.dc.html` en el canvas, salvo la
leyenda de ese mockup, que quedó vieja):
- **Descripción**: input de texto, opcional.
- **Es fijo**: checkbox o toggle. Texto de ayuda breve, sin prometer
  automatismo: *"Para identificarlo como gasto habitual (luz,
  alquiler, suscripciones). Lo cargás igual cada vez, con el monto
  real."*

Al guardar, el `Gasto` incluye `esFijo` y `descripcion` (si se
completó).

### Tests: sumar a `CargarGasto.test.tsx`
4. Tildar "Es fijo" y guardar persiste `esFijo: true`.
5. Completar "Descripción" y guardar persiste ese texto; dejarlo vacío
   guarda sin el campo (o `undefined`), no un string vacío forzado.

## `Inicio.tsx`

**Sacar del todo** el formulario de agregar/editar gasto fijo (nombre +
monto + activo) — ya no existe esa tabla.

**La tarjeta "Gastos" pasa a tener:**
- **"Fijos"**: vista de solo lectura, filtrando los gastos del período
  actual con `esFijo: true` (reutilizando `gastosDelPeriodo`), con el
  total. Mismas acciones de editar/eliminar que ya existen para
  cualquier gasto — no hace falta un mecanismo nuevo.
- **"Últimos"**: igual que ahora, todos los gastos del período. Los
  marcados `esFijo` llevan una etiqueta chica ("Fijo"), igual a como
  se ve en el mockup `GastosOpcionB.dc.html`.

**Tarjetas colapsables:** "Ingresos" y "Gastos" arrancan colapsadas,
con un encabezado tocable que las expande/contrae (ícono de flecha,
estado guardado solo en memoria del componente, no hace falta
persistirlo).

### Tests: actualizar `Inicio.test.tsx`
- Sacar los tests del formulario de gasto fijo (agregar/editar/activo).
- Un gasto cargado con `esFijo: true` aparece en la subsección "Fijos"
  del período actual.
- El saldo se calcula igual sin distinguir fijo de informal — ambos
  descuentan por igual.
- Tocar el encabezado de "Gastos" o "Ingresos" alterna si el contenido
  se ve.

## AGENTS.md
Actualizar la sección "Modelo de datos": ya no hay tres tablas sino
dos (`gastos`, `ingresos`, más `periodos`) — sacar la mención a
`gastosFijos`.

## Criterio de aceptación
- `npm run test` en verde, `npm run build` sin errores.
- Cargar un gasto de luz con un monto distinto cada vez, tildado
  "Es fijo", sin que nada se descuente solo ni se repita.

## Fuera de alcance
No hay forma de "repetir el gasto fijo del mes pasado" ni de
precargar el monto anterior como sugerencia — se puede evaluar más
adelante si se vuelve tedioso cargarlo siempre desde cero.
