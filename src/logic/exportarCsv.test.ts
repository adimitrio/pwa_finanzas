import { describe, it, expect } from 'vitest'
import { gastosACsv, formatearMontoCsv, nombreArchivoCsv } from './exportarCsv'
import type { Gasto, Periodo } from '../db/schema'

const periodo: Periodo = {
  id: 'p1',
  fechaInicio: '2026-09-01',
  nombre: 'Octubre 2026',
  actualizadoEn: Date.now(),
}

function gasto(override: Partial<Gasto> = {}): Gasto {
  return {
    id: crypto.randomUUID(),
    monto: 480000,
    categoria: 'super',
    fecha: '2026-09-15',
    actualizadoEn: Date.now(),
    ...override,
  }
}

describe('formatearMontoCsv', () => {
  it('100 → "1.00"', () => expect(formatearMontoCsv(100)).toBe('1.00'))
  it('480000 → "4800.00"', () => expect(formatearMontoCsv(480000)).toBe('4800.00'))
  it('4505000 → "45050.00"', () => expect(formatearMontoCsv(4505000)).toBe('45050.00'))
  it('5 → "0.05"', () => expect(formatearMontoCsv(5)).toBe('0.05'))
})

describe('gastosACsv', () => {
  it('encabezado exacto y orden de columnas', () => {
    const csv = gastosACsv([], periodo)
    expect(csv).toBe('fecha,monto,categoria,descripcion,periodo')
  })

  it('período sin gastos → solo encabezado', () => {
    // gasto fuera de rango
    const fuera = gasto({ fecha: '2026-08-31' })
    const csv = gastosACsv([fuera], periodo)
    expect(csv).toBe('fecha,monto,categoria,descripcion,periodo')
  })

  it('una fila con todos los campos; descripción vacía queda vacía', () => {
    const g = gasto({ id: 'g-1', monto: 480000, fecha: '2026-09-15' })
    const csv = gastosACsv([g], periodo)
    const filas = csv.split('\r\n')
    expect(filas).toHaveLength(2)
    expect(filas[1]).toBe(`2026-09-15,4800.00,super,,Octubre 2026`)
  })

  it('descripción presente se incluye', () => {
    const g = gasto({ id: 'g-2', fecha: '2026-09-10', descripcion: 'Luz septiembre' })
    const csv = gastosACsv([g], periodo)
    const fila = csv.split('\r\n')[1]
    expect(fila).toContain('Luz septiembre')
  })

  it('escapado: descripción con coma', () => {
    const g = gasto({ fecha: '2026-09-10', descripcion: 'Pan, leche' })
    const csv = gastosACsv([g], periodo)
    expect(csv).toContain('"Pan, leche"')
  })

  it('escapado: descripción con comillas dobles', () => {
    const g = gasto({ fecha: '2026-09-10', descripcion: 'Deuda "anterior"' })
    const csv = gastosACsv([g], periodo)
    expect(csv).toContain('"Deuda ""anterior"""')
  })

  it('escapado: descripción con salto de línea', () => {
    const g = gasto({ fecha: '2026-09-10', descripcion: 'Línea1\nLínea2' })
    const csv = gastosACsv([g], periodo)
    expect(csv).toContain('"Línea1\nLínea2"')
  })

  it('solo entran gastos del rango del período: incluye fechaFin, excluye anterior a fechaInicio y posterior a fechaFin', () => {
    const periodoCerrado: Periodo = { ...periodo, fechaFin: '2026-09-30' }
    const dentro = gasto({ id: 'dentro', fecha: '2026-09-30' })  // igual a fechaFin: incluido
    const antesDeInicio = gasto({ id: 'antes', fecha: '2026-08-31' })
    const despuesDeFin = gasto({ id: 'despues', fecha: '2026-10-01' })
    const csv = gastosACsv([dentro, antesDeInicio, despuesDeFin], periodoCerrado)
    expect(csv).toContain('2026-09-30')
    expect(csv).not.toContain('2026-08-31')
    expect(csv).not.toContain('2026-10-01')
  })

  it('orden por fecha ascendente', () => {
    const g1 = gasto({ id: 'g-tarde', fecha: '2026-09-20' })
    const g2 = gasto({ id: 'g-temprano', fecha: '2026-09-05' })
    const csv = gastosACsv([g1, g2], periodo)
    const filas = csv.split('\r\n').slice(1)
    expect(filas[0]).toContain('2026-09-05')
    expect(filas[1]).toContain('2026-09-20')
  })

  it('fin de línea es \\r\\n', () => {
    const g = gasto({ fecha: '2026-09-10' })
    const csv = gastosACsv([g], periodo)
    expect(csv).toContain('\r\n')
  })
})

describe('nombreArchivoCsv', () => {
  it('"Octubre 2026" → "gastos-octubre-2026.csv"', () => {
    expect(nombreArchivoCsv(periodo)).toBe('gastos-octubre-2026.csv')
  })

  it('nombre con tildes → sin tildes', () => {
    const p: Periodo = { ...periodo, nombre: 'Septiembre' }
    expect(nombreArchivoCsv(p)).toBe('gastos-septiembre.csv')
  })

  it('nombre con ñ → sin ñ', () => {
    const p: Periodo = { ...periodo, nombre: 'Año 2026' }
    // ñ se normaliza → n
    expect(nombreArchivoCsv(p)).toBe('gastos-ano-2026.csv')
  })
})
