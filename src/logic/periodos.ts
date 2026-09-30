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

export function diaSiguiente(fecha: string): string {
  // En UTC de punta a punta: con hora local + toISOString(), en zonas al este
  // de UTC el resultado retrocedía un día.
  const d = new Date(fecha + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function gastosDelPeriodo<T extends { fecha: string }>(
  gastos: T[],
  periodo: { fechaInicio: string; fechaFin?: string }
): T[] {
  return gastos.filter(g =>
    g.fecha >= periodo.fechaInicio &&
    (periodo.fechaFin === undefined || g.fecha <= periodo.fechaFin)
  )
}
