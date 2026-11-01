import type { Gasto, Ingreso, Periodo } from '../db/schema'
import { gastosDelPeriodo } from './periodos'

/** Formatea centavos como pesos con 2 decimales, sin float.
 *  Ej: 100 → "1.00",  480000 → "4800.00",  5 → "0.05" */
export function formatearMontoCsv(centavos: number): string {
  const pesos = Math.trunc(centavos / 100)
  const cts = centavos % 100
  return `${pesos}.${String(cts).padStart(2, '0')}`
}

function escaparCampo(valor: string): string {
  if (valor.includes(',') || valor.includes('"') || valor.includes('\n') || valor.includes('\r')) {
    return `"${valor.replace(/"/g, '""')}"`
  }
  return valor
}

/** Arma el CSV completo (encabezado + filas) con los movimientos de un período:
 *  primero los ingresos (por actualizadoEn asc), después los gastos (por fecha asc).
 *  El monto siempre es positivo: el signo lo da `tipo`. Sin movimientos, solo el encabezado. */
export function movimientosACsv(gastos: Gasto[], ingresos: Ingreso[], periodo: Periodo): string {
  const encabezado = 'tipo,fecha,monto,categoria,descripcion,periodo'

  const filasIngresos = ingresos
    .filter(i => i.periodoId === periodo.id)
    .sort((a, b) => a.actualizadoEn - b.actualizadoEn)
    .map(i => ['ingreso', periodo.fechaInicio, formatearMontoCsv(i.montoNeto), '', i.nombre, periodo.nombre])

  const filasGastos = gastosDelPeriodo(gastos, periodo)
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(g => [
      'gasto', g.fecha, formatearMontoCsv(g.monto), g.categoria, g.descripcion ?? '', periodo.nombre,
    ])

  const filas = [...filasIngresos, ...filasGastos].map(campos => campos.map(escaparCampo).join(','))
  return [encabezado, ...filas].join('\r\n')
}

/** Nombre de archivo: movimientos-<nombre en minúsculas sin tildes>.csv
 *  Ej: "Octubre 2026" → "movimientos-octubre-2026.csv" */
export function nombreArchivoCsv(periodo: Periodo): string {
  const sinTildes = periodo.nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quita diacríticos
  const slug = sinTildes
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return `movimientos-${slug}.csv`
}
