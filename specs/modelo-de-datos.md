# Spec: Modelo de datos base

## Objetivo
Dejar armada la base de datos local (Dexie/IndexedDB) con las tres tablas
del MVP, tipadas, más los tests que confirman que guardar y leer funciona.

## Dependencias a instalar
- `dexie` (persistencia)
- `vitest` (tests) — agregar el script `"test": "vitest run"` en
  `package.json`

## Archivo a crear: `src/db/schema.ts`

```ts
import Dexie, { Table } from 'dexie'

export type Categoria =
  | 'super' | 'comida' | 'transporte' | 'salud' | 'hogar' | 'ocio' | 'otros'
export type MedioPago = 'efectivo' | 'debito' | 'credito'

export interface Gasto {
  id: string           // UUID (crypto.randomUUID())
  monto: number         // centavos, entero — nunca float
  categoria: Categoria
  medioPago: MedioPago
  fecha: string          // 'YYYY-MM-DD'
  actualizadoEn: number  // Date.now()
}

export interface GastoFijo {
  id: string
  nombre: string
  monto: number       // centavos
  activo: boolean
  actualizadoEn: number
}

export interface Ingreso {
  id: string
  mes: string          // 'YYYY-MM'
  montoNeto: number    // centavos
  actualizadoEn: number
}

class FinanzasDB extends Dexie {
  gastos!: Table<Gasto, string>
  gastosFijos!: Table<GastoFijo, string>
  ingresos!: Table<Ingreso, string>

  constructor() {
    super('finanzas')
    this.version(1).stores({
      gastos: 'id, fecha, categoria',
      gastosFijos: 'id, activo',
      ingresos: 'id, mes'
    })
  }
}

export const db = new FinanzasDB()
```

Usar este código tal cual — ya está revisado y acordado. No cambiar nombres
de campos ni agregar tablas o columnas nuevas.

## Tests a escribir: `src/db/schema.test.ts`
Con Vitest, usando `fake-indexeddb` para que corra sin navegador
(instalar como dependencia de desarrollo). Casos mínimos:

1. Guardar un `Gasto` con `db.gastos.add(...)` y leerlo de vuelta con
   `db.gastos.get(id)` — los campos tienen que coincidir exactamente.
2. Guardar un `GastoFijo` y un `Ingreso` de la misma forma.
3. Guardar dos gastos con distinta `fecha` y confirmar que
   `db.gastos.where('fecha').equals(...)` devuelve solo el que corresponde.

## Criterio de aceptación
- `npm run test` corre en verde.
- `npm run build` no tira errores de TypeScript.
- Ningún campo de monto es `number` con decimales en los datos de prueba
  (siempre enteros).

## Fuera de alcance
No crear pantallas ni componentes React todavía. No tocar `App.tsx`. Esto
es solo la capa de datos.
