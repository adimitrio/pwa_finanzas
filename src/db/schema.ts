import Dexie, { type Table } from 'dexie'

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
