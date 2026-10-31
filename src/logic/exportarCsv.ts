import type { Gasto, Periodo } from '../db/schema'
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

/** Arma el CSV completo (encabezado + filas) para los gastos de un período.
 *  Si no hay gastos, devuelve solo el encabezado. */
export function gastosACsv(gastos: Gasto[], periodo: Periodo): string {
  const encabezado = 'fecha,monto,categoria,descripcion,periodo'
  const delPeriodo = gastosDelPeriodo(gastos, periodo)
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  const filas = delPeriodo.map(g => {
    const campos = [
      g.fecha,
      formatearMontoCsv(g.monto),
      g.categoria,
      g.descripcion ?? '',
      periodo.nombre,
    ]
    return campos.map(escaparCampo).join(',')
  })

  return [encabezado, ...filas].join('\r\n')
}

/** Nombre de archivo: gastos-<nombre en minúsculas sin tildes>-.csv
 *  Ej: "Octubre 2026" → "gastos-octubre-2026.csv"
 *      "Setiembre" → "gastos-setiembre.csv" */
export function nombreArchivoCsv(periodo: Periodo): string {
  const sinTildes = periodo.nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quita diacríticos
  const slug = sinTildes
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return `gastos-${slug}.csv`
}
