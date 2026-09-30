# Spec: Pantalla principal (Inicio)

## Objetivo
La pantalla que ves al abrir la app: el saldo del mes, con acceso rápido a
"Cargar gasto" y a los últimos gastos.

## Nota sobre el orden
En la planificación original, "saldo del mes" e "ingresos y gastos fijos"
eran dos specs separados. Van juntos acá: sin poder cargar el ingreso y
los gastos fijos, el saldo no tiene con qué calcularse y la pantalla
queda vacía sin sentido. Es un reordenamiento de specs ya previstos en
el MVP, no una ampliación de alcance.

## Dependencias nuevas
- `dexie-react-hooks` — para `useLiveQuery`, así los componentes se
  actualizan solos cuando cambian los datos (por ejemplo, al volver de
  cargar un gasto), sin lógica manual de refetch.

## Función pura: `src/logic/saldo.ts`
```ts
export interface GastoFijoResumen { monto: number; activo: boolean }
export interface GastoResumen { monto: number }

export function calcularSaldoDelMes(
  ingresoNeto: number,                  // centavos
  gastosFijos: GastoFijoResumen[],
  gastosDelMes: GastoResumen[]
): number {
  const totalFijos = gastosFijos
    .filter(g => g.activo)
    .reduce((acc, g) => acc + g.monto, 0)
  const totalGastos = gastosDelMes.reduce((acc, g) => acc + g.monto, 0)
  return ingresoNeto - totalFijos - totalGastos
}
```

### Tests: `src/logic/saldo.test.ts`
Sin Dexie ni DOM, con datos de prueba armados a mano:
1. Sin gastos fijos ni gastos → saldo = ingreso.
2. Un gasto fijo con `activo: false` no descuenta.
3. Combinación de fijos activos + gastos → resta ambos del ingreso.
4. Si los gastos superan el ingreso, el saldo da negativo (no se fuerza
   a 0).

## Componente: `src/components/Inicio.tsx`
Recibe `onCargarGasto: () => void`.

- **Saldo:** número grande, resultado de `calcularSaldoDelMes` con los
  datos del mes actual (`new Date().toISOString().slice(0, 7)` para
  filtrar `ingresos` por `mes`, y `fecha` de `gastos` que empiece con ese
  mismo string para filtrar los gastos).
- Debajo del saldo, una línea con el desglose: ingreso, total de fijos
  activos, total de gastos — en texto chico, no hace falta gráfico.
- **Botón "Cargar gasto"**, grande, llama a `onCargarGasto`.
- **Sección "Ingreso y gastos fijos"** (debajo, no es lo primero que se
  ve):
  - Un campo numérico para el ingreso neto del mes. Al guardar, hace
    upsert en la tabla `ingresos` por `mes` (si ya existe un registro
    para el mes actual, lo actualiza; si no, crea uno).
  - Lista de gastos fijos (`nombre`, `monto`, toggle `activo`). Botón
    para agregar uno nuevo (nombre + monto, `activo: true` por
    defecto) y botón para eliminar cada uno.
- **Sección "Últimos gastos":** los últimos 10 registros de `gastos`
  ordenados por `actualizadoEn` descendente, mostrando categoría, medio
  de pago y monto. Sin edición ni borrado todavía, solo lectura.

## Ajustes a `src/components/CargarGasto.tsx`
- Nuevo prop `onVolver: () => void`.
- Botón "✕" arriba a la izquierda que llama a `onVolver()` sin guardar.
- Después de guardar exitosamente, además de resetear el formulario
  (comportamiento ya existente, no tocar), llamar a `onVolver()` para
  volver a Inicio.

## Navegación en `src/App.tsx`
Sin librería de routing — alcanza con estado local:
```ts
const [pantalla, setPantalla] = useState<'inicio' | 'cargar'>('inicio')
```
Renderiza `Inicio` o `CargarGasto` según el estado, pasando los
callbacks correspondientes.

## Tests
- `src/components/Inicio.test.tsx`: insertar datos de prueba
  directamente con `db.ingresos.add`, `db.gastosFijos.add`,
  `db.gastos.add` antes de renderizar, y verificar que el saldo
  mostrado en pantalla es el esperado.
- Guardar el ingreso dos veces con distinto valor deja un solo registro
  en `ingresos` para el mes actual (confirma el upsert, no duplica).
- Agregar un gasto fijo lo persiste y aparece en la lista.

## Criterio de aceptación
- `npm run test` en verde (incluye los tests ya existentes).
- `npm run build` sin errores de TypeScript.
- Cargar un gasto desde Inicio y volver muestra el saldo ya actualizado,
  sin recargar la página a mano.

## Fuera de alcance
No selector de mes (solo el mes actual). No editar ni borrar gastos
individuales desde "Últimos gastos". No confirmación al borrar un gasto
fijo. No PWA/offline todavía. No exportar/importar JSON.
