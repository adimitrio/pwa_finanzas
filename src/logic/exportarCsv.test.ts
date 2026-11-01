import { describe, it, expect } from 'vitest'
import { movimientosACsv, formatearMontoCsv, nombreArchivoCsv } from './exportarCsv'
import type { Gasto, Ingreso, Periodo } from '../db/schema'

const periodo: Periodo = {
  id: 'p1',
  fechaInicio: '2026-09-01',
  nombre: 'Octubre 2026',
  actualizadoEn: Date.now(),
}

function ingreso(override: Partial<Ingreso> = {}): Ingreso {
  return {
    id: crypto.randomUUID(),
    periodoId: 'p1',
    nombre: 'Sueldo',
    montoNeto: 235000000,
    actualizadoEn: 1,
    ...override,
  }
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

describe('movimientosACsv', () => {
  it('encabezado exacto y orden de columnas', () => {
    const csv = movimientosACsv([], [], periodo)
    expect(csv).toBe('tipo,fecha,monto,categoria,descripcion,periodo')
  })

  it('período sin gastos → solo encabezado', () => {
    // gasto fuera de rango
    const fuera = gasto({ fecha: '2026-08-31' })
    const csv = movimientosACsv([fuera], [], periodo)
    expect(csv).toBe('tipo,fecha,monto,categoria,descripcion,periodo')
  })

  it('una fila con todos los campos; descripción vacía queda vacía', () => {
    const g = gasto({ id: 'g-1', monto: 480000, fecha: '2026-09-15' })
    const csv = movimientosACsv([g], [], periodo)
    const filas = csv.split('\r\n')
    expect(filas).toHaveLength(2)
    expect(filas[1]).toBe(`gasto,2026-09-15,4800.00,super,,Octubre 2026`)
  })

  it('descripción presente se incluye', () => {
    const g = gasto({ id: 'g-2', fecha: '2026-09-10', descripcion: 'Luz septiembre' })
    const csv = movimientosACsv([g], [], periodo)
    const fila = csv.split('\r\n')[1]
    expect(fila).toContain('Luz septiembre')
  })

  it('escapado: descripción con coma', () => {
    const g = gasto({ fecha: '2026-09-10', descripcion: 'Pan, leche' })
    const csv = movimientosACsv([g], [], periodo)
    expect(csv).toContain('"Pan, leche"')
  })

  it('escapado: descripción con comillas dobles', () => {
    const g = gasto({ fecha: '2026-09-10', descripcion: 'Deuda "anterior"' })
    const csv = movimientosACsv([g], [], periodo)
    expect(csv).toContain('"Deuda ""anterior"""')
  })

  it('escapado: descripción con salto de línea', () => {
    const g = gasto({ fecha: '2026-09-10', descripcion: 'Línea1\nLínea2' })
    const csv = movimientosACsv([g], [], periodo)
    expect(csv).toContain('"Línea1\nLínea2"')
  })

  it('solo entran gastos del rango del período: incluye fechaFin, excluye anterior a fechaInicio y posterior a fechaFin', () => {
    const periodoCerrado: Periodo = { ...periodo, fechaFin: '2026-09-30' }
    const dentro = gasto({ id: 'dentro', fecha: '2026-09-30' })  // igual a fechaFin: incluido
    const antesDeInicio = gasto({ id: 'antes', fecha: '2026-08-31' })
    const despuesDeFin = gasto({ id: 'despues', fecha: '2026-10-01' })
    const csv = movimientosACsv([dentro, antesDeInicio, despuesDeFin], [], periodoCerrado)
    expect(csv).toContain('2026-09-30')
    expect(csv).not.toContain('2026-08-31')
    expect(csv).not.toContain('2026-10-01')
  })

  it('orden por fecha ascendente', () => {
    const g1 = gasto({ id: 'g-tarde', fecha: '2026-09-20' })
    const g2 = gasto({ id: 'g-temprano', fecha: '2026-09-05' })
    const csv = movimientosACsv([g1, g2], [], periodo)
    const filas = csv.split('\r\n').slice(1)
    expect(filas[0]).toContain('2026-09-05')
    expect(filas[1]).toContain('2026-09-20')
  })

  it('fin de línea es \\r\\n', () => {
    const g = gasto({ fecha: '2026-09-10' })
    const csv = movimientosACsv([g], [], periodo)
    expect(csv).toContain('\r\n')
  })
})

describe('movimientosACsv con ingresos', () => {
  it('fila de ingreso: fecha = fechaInicio, categoría vacía, descripción = nombre', () => {
    const csv = movimientosACsv([], [ingreso()], periodo)
    expect(csv.split('\r\n')[1]).toBe('ingreso,2026-09-01,2350000.00,,Sueldo,Octubre 2026')
  })

  it('los ingresos de otro período no entran', () => {
    const csv = movimientosACsv([], [ingreso({ periodoId: 'otro' })], periodo)
    expect(csv).toBe('tipo,fecha,monto,categoria,descripcion,periodo')
  })

  it('orden: ingresos primero (por actualizadoEn), después gastos por fecha', () => {
    const csv = movimientosACsv(
      [gasto({ fecha: '2026-09-20' }), gasto({ fecha: '2026-09-05' })],
      [ingreso({ nombre: 'Bono', actualizadoEn: 2 }), ingreso({ nombre: 'Sueldo', actualizadoEn: 1 })],
      periodo,
    )
    const filas = csv.split('\r\n').slice(1)
    expect(filas.map(f => f.split(',')[0])).toEqual(['ingreso', 'ingreso', 'gasto', 'gasto'])
    expect(filas[0]).toContain('Sueldo')
    expect(filas[1]).toContain('Bono')
    expect(filas[2]).toContain('2026-09-05')
    expect(filas[3]).toContain('2026-09-20')
  })

  it('período con solo ingresos → encabezado + sus filas', () => {
    const csv = movimientosACsv([], [ingreso(), ingreso({ nombre: 'Bono' })], periodo)
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  it('escapado: nombre de ingreso con coma entra entre comillas', () => {
    const csv = movimientosACsv([], [ingreso({ nombre: 'Bono, extra' })], periodo)
    expect(csv).toContain('"Bono, extra"')
  })
})

describe('nombreArchivoCsv', () => {
  it('"Octubre 2026" → "movimientos-octubre-2026.csv"', () => {
    expect(nombreArchivoCsv(periodo)).toBe('movimientos-octubre-2026.csv')
  })

  it('nombre con tildes → sin tildes', () => {
    const p: Periodo = { ...periodo, nombre: 'Septiembre' }
    expect(nombreArchivoCsv(p)).toBe('movimientos-septiembre.csv')
  })

  it('nombre con ñ → sin ñ', () => {
    const p: Periodo = { ...periodo, nombre: 'Año 2026' }
    // ñ se normaliza → n
    expect(nombreArchivoCsv(p)).toBe('movimientos-ano-2026.csv')
  })
})
