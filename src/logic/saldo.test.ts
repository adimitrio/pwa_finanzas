import { describe, it, expect } from 'vitest'
import { calcularSaldoDelMes } from './saldo'

describe('calcularSaldoDelMes', () => {
  it('sin gastos fijos ni gastos, saldo = ingreso', () => {
    expect(calcularSaldoDelMes(500000, [], [])).toBe(500000)
  })

  it('un gasto fijo con activo: false no descuenta', () => {
    const fijos = [{ monto: 100000, activo: false }]
    expect(calcularSaldoDelMes(500000, fijos, [])).toBe(500000)
  })

  it('fijos activos + gastos del mes restan del ingreso', () => {
    const fijos = [
      { monto: 100000, activo: true },
      { monto: 50000, activo: false }, // no descuenta
    ]
    const gastos = [{ monto: 30000 }, { monto: 20000 }]
    // 500000 - 100000 - (30000 + 20000) = 350000
    expect(calcularSaldoDelMes(500000, fijos, gastos)).toBe(350000)
  })

  it('si los gastos superan el ingreso, el saldo da negativo', () => {
    const fijos = [{ monto: 300000, activo: true }]
    const gastos = [{ monto: 400000 }]
    // 500000 - 300000 - 400000 = -200000
    expect(calcularSaldoDelMes(500000, fijos, gastos)).toBe(-200000)
  })
})
