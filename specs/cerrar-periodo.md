# Spec: Cerrar período (rediseño, sin `periodoId` en `Gasto`)

## Objetivo
Reemplazar el botón "Cobré" por "Cerrar período", que pide la fecha en
que termina el período actual (no siempre es hoy) y el nombre del que
arranca. A qué período pertenece cada gasto se calcula siempre a
partir de su fecha, nunca se guarda como un campo aparte.

## Por qué se saca `periodoId` de `Gasto`
Se había agregado en el spec anterior para resolver la ambigüedad de
"cargué un gasto el mismo día que cobré". Con una fecha de fin
explícita al cerrar, ese corte queda inequívoco sin necesidad de
guardar nada extra: comparando la `fecha` del gasto contra el rango de
cada período alcanza. Un campo menos que puede desincronizarse.

## Cambio de schema (`src/db/schema.ts`)
Ajustar `version(2)` directamente, no agregar `version(3)`: sacar
`periodoId` de `Gasto` y de su índice. Como es la única migración que
corrió hasta ahora y son datos de prueba locales, no hace falta
arrastrar el campo viejo — en un proyecto con datos reales en
producción, esto sí sería una `version(3)` nueva.

```ts
export interface Gasto {
  id: string
  monto: number
  categoria: Categoria
  medioPago: MedioPago
  fecha: string
  descripcion?: string
  actualizadoEn: number
}
```
Índice, de vuelta a como estaba:
```ts
gastos: 'id, fecha, categoria',
```

**Sacar también de `CargarGasto.tsx`** el ajuste de "asignar
`periodoId` al guardar" que pedía el spec anterior — ya no aplica,
`CargarGasto` vuelve a no saber nada de períodos.

**Mantener:** el botón "Cargar gasto" en Inicio sigue deshabilitado
hasta que exista al menos un período (evita gastos sin ningún período
que los cubra).

## Interfaz `Periodo` — sin cambios respecto al spec anterior
```ts
export interface Periodo {
  id: string
  fechaInicio: string
  fechaFin?: string     // ausente mientras es el período actual
  nombre: string
  actualizadoEn: number
}
```

## Funciones puras: sumar a `src/logic/periodos.ts`
(mantener `diaSiguiente`, ya definida antes)

```ts
export function gastosDelPeriodo<T extends { fecha: string }>(
  gastos: T[],
  periodo: { fechaInicio: string; fechaFin?: string }
): T[] {
  return gastos.filter(g =>
    g.fecha >= periodo.fechaInicio &&
    (periodo.fechaFin === undefined || g.fecha <= periodo.fechaFin)
  )
}
```

### Tests: sumar a `src/logic/periodos.test.ts`
1. Un gasto con fecha dentro del rango de un período cerrado (con
   `fechaFin`) se incluye.
2. Un gasto con fecha posterior a `fechaFin` no se incluye.
3. Un gasto con fecha **igual** a `fechaFin` (el mismo día del cierre)
   se incluye en el período que se cierra, no en el siguiente.
4. Con un período sin `fechaFin` (el actual, abierto), un gasto de
   cualquier fecha posterior o igual a `fechaInicio` se incluye, sin
   límite superior.

## No tocar `calcularSaldoDelMes`
Sigue igual. Cambia cómo se arman sus argumentos: usar
`gastosDelPeriodo(todosLosGastos, periodoActual)` para obtener los
gastos, en vez de filtrar por `periodoId` contra Dexie.

## Reorganización de `src/components/Inicio.tsx`
De paso que se toca este archivo: la tarjeta actual "Ingreso y gastos
fijos" mezcla dos cosas que no van juntas (plata que entra, plata que
sale), mientras que "Cargar gasto" y "Últimos gastos" quedan sueltos
por su cuenta — aunque las tres cosas (Cargar gasto, Gastos fijos,
Últimos gastos) son la misma categoría: gastos.

Reordenar así:
- **"+ Cargar gasto"** se mantiene igual, arriba, como la acción
  principal — no se toca su prioridad ni su tamaño.
- **Tarjeta "Ingresos"**, propia: solo la lista de ingresos del período
  y su formulario para agregar (lo que hoy vive adentro de "Ingreso y
  gastos fijos").
- **Tarjeta "Gastos"**, propia, con dos subsecciones:
  - "Fijos" — la lista editable que hoy está en "Ingreso y gastos
    fijos".
  - "Últimos" — lo que hoy es la tarjeta aparte "Últimos gastos".
- La tarjeta de cierre de período sigue al final, sin cambios.

Es solo reagrupar visualmente, sin tocar lógica — los textos, inputs y
botones son los mismos, solo cambian de tarjeta. No hacen falta tests
nuevos para esto; los que ya existen en `Inicio.test.tsx` deberían
seguir pasando tal cual, porque buscan por texto/rol, no por
ubicación.

### Sección para cerrar el período
Igual que el spec anterior: sección propia para cerrar el período,
visualmente distinta de las acciones cotidianas (no el mismo dorado
que "Cargar gasto"), con fecha de fin y nombre del período nuevo.

**Corrección al valor por defecto de "Fecha de fin":** tiene que ser
**ayer**, no hoy (así estaba mal en la versión anterior de este spec).
El día que cerrás el período —normalmente el día que cobrás— tiene que
quedar del lado del período **nuevo**, no del viejo. Con fecha de fin =
ayer, `fechaInicio` del período nuevo (`díaSiguiente(fechaFin)`) es
hoy, y cualquier gasto que cargues hoy, incluso después de cerrar, cae
en el período nuevo. Sigue siendo editable, por si alguna vez hace
falta cerrar con otra fecha.

**La transacción de cierre se simplifica** — ya no hay paso de
reasignar gastos, porque no hay nada guardado que reasignar; la
pertenencia se recalcula sola apenas el período tiene su `fechaFin`:
1. Generar `nuevoPeriodoId`.
2. Calcular el saldo final con `calcularSaldoDelMes`, usando
   `gastosDelPeriodo` contra el período actual con
   `fechaFin: fechaFinIngresada` (todavía sin guardar, solo para este
   cálculo).
3. Actualizar el período actual en la base: `fechaFin: fechaFinIngresada`.
4. Crear el período nuevo: `fechaInicio: diaSiguiente(fechaFinIngresada)`,
   `nombre`, sin `fechaFin`.
5. Con `calcularAsientoDeCierre(saldoFinal)`, crear el `Ingreso` o
   `Gasto` de apertura en el período nuevo — sin `periodoId` en el caso
   del `Gasto`, ya no existe ese campo. Su `fecha` es la
   `fechaInicio` del período nuevo, no "hoy" — así el asiento siempre
   cae dentro de su propio período, sin importar qué fecha de cierre
   se haya elegido.

**Validaciones**, iguales al spec anterior: la fecha de fin no puede
ser anterior al inicio del período actual ni posterior a hoy.

## Tests: sumar a `src/components/Inicio.test.tsx`
5. Cerrar con fecha de fin = hoy: comportamiento normal.
6. Cerrar con fecha de fin anterior a hoy, con un gasto cargado
   después de esa fecha: ese gasto queda del lado del período nuevo
   apenas se consulta con `gastosDelPeriodo`, sin ningún paso extra.
7. Fecha de fin futura, o anterior al inicio del período actual: error,
   no cierra nada.

## Criterio de aceptación
- `npm run test` en verde, `npm run build` sin errores.
- El escenario "cierro dos días tarde, con un gasto cargado en el
  medio" da el resultado correcto, ahora sin ningún campo extra en
  `Gasto`.

## Fuera de alcance
Igual que el spec anterior: no se puede reabrir un período ya cerrado,
no hay reasignación manual de gastos individuales.
