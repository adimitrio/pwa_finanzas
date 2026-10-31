import Dexie, { type Table } from 'dexie'

export type Categoria =
  | 'super' | 'comida' | 'transporte' | 'salud' | 'hogar' | 'ocio' | 'otros'

export interface Gasto {
  id: string           // UUID (crypto.randomUUID())
  monto: number         // centavos, entero — nunca float
  categoria: Categoria
  fecha: string          // 'YYYY-MM-DD'
  descripcion?: string   // ej. 'Deuda mes anterior'
  actualizadoEn: number  // Date.now()
}

export interface Periodo {
  id: string
  fechaInicio: string  // 'YYYY-MM-DD', el día que se cobró
  fechaFin?: string    // ausente mientras es el período actual
  nombre: string       // ej. 'Octubre 2026', lo elige el usuario
  actualizadoEn: number
}

export interface Ingreso {
  id: string
  periodoId: string
  nombre: string       // 'Sueldo', 'Bono', 'Saldo mes anterior', etc.
  montoNeto: number    // centavos, siempre positivo
  actualizadoEn: number
}

class FinanzasDB extends Dexie {
  gastos!: Table<Gasto, string>
  ingresos!: Table<Ingreso, string>
  periodos!: Table<Periodo, string>

  constructor() {
    super('finanzas')
    this.version(1).stores({
      gastos: 'id, fecha, categoria',
      gastosFijos: 'id, activo',
      ingresos: 'id, mes'
    })
    this.version(2).stores({
      gastos: 'id, fecha, categoria',
      gastosFijos: null, // tabla eliminada: los gastos fijos ya no existen como concepto
      ingresos: 'id, periodoId',
      periodos: 'id, fechaInicio'
    })
  }
}

export const db = new FinanzasDB()
