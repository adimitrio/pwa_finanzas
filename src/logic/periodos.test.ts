import { describe, it, expect } from 'vitest'
import { obtenerPeriodoActual, calcularAsientoDeCierre, diaSiguiente, gastosDelPeriodo } from './periodos'

describe('obtenerPeriodoActual', () => {
  it('devuelve el período con fechaInicio más reciente', () => {
    const periodos = [
      { id: 'a', fechaInicio: '2026-08-05', nombre: 'Agosto' },
      { id: 'c', fechaInicio: '2026-10-03', nombre: 'Octubre' },
      { id: 'b', fechaInicio: '2026-09-04', nombre: 'Septiembre' },
    ]
    expect(obtenerPeriodoActual(periodos)?.id).toBe('c')
  })

  it('sin períodos devuelve null', () => {
    expect(obtenerPeriodoActual([])).toBeNull()
  })
})

describe('calcularAsientoDeCierre', () => {
  it('saldo positivo → ingreso "Saldo mes anterior"', () => {
    expect(calcularAsientoDeCierre(350000)).toEqual({
      tipo: 'ingreso', nombre: 'Saldo mes anterior', monto: 350000,
    })
  })

  it('saldo exactamente 0 → ingreso (no gasto), por decisión explícita', () => {
    expect(calcularAsientoDeCierre(0)).toEqual({
      tipo: 'ingreso', nombre: 'Saldo mes anterior', monto: 0,
    })
  })

  it('saldo negativo → gasto "Deuda mes anterior" con monto positivo', () => {
    expect(calcularAsientoDeCierre(-200000)).toEqual({
      tipo: 'gasto', descripcion: 'Deuda mes anterior', monto: 200000,
    })
  })
})

describe('diaSiguiente', () => {
  it('avanza un día', () => {
    expect(diaSiguiente('2026-09-30')).toBe('2026-10-01')
  })

  it('cruza el año', () => {
    expect(diaSiguiente('2026-12-31')).toBe('2027-01-01')
  })
})

describe('gastosDelPeriodo', () => {
  const cerrado = { fechaInicio: '2026-09-01', fechaFin: '2026-09-30' }
  const g = (fecha: string) => ({ fecha })

  it('incluye un gasto dentro del rango de un período cerrado', () => {
    expect(gastosDelPeriodo([g('2026-09-15')], cerrado)).toEqual([g('2026-09-15')])
  })

  it('no incluye un gasto posterior a fechaFin', () => {
    expect(gastosDelPeriodo([g('2026-10-01')], cerrado)).toEqual([])
  })

  it('un gasto con fecha igual a fechaFin queda en el período que se cierra', () => {
    expect(gastosDelPeriodo([g('2026-09-30')], cerrado)).toEqual([g('2026-09-30')])
    // y no en el siguiente, que arranca el día después
    expect(gastosDelPeriodo([g('2026-09-30')], { fechaInicio: '2026-10-01' })).toEqual([])
  })

  it('un gasto anterior a fechaInicio no se incluye', () => {
    expect(gastosDelPeriodo([g('2026-08-31')], cerrado)).toEqual([])
  })

  it('período abierto (sin fechaFin): incluye cualquier fecha desde fechaInicio, sin límite superior', () => {
    const abierto = { fechaInicio: '2026-10-01' }
    expect(gastosDelPeriodo([g('2026-10-01'), g('2030-01-01')], abierto)).toHaveLength(2)
  })
})
