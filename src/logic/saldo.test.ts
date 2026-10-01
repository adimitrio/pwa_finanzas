import { describe, it, expect } from 'vitest'
import { calcularSaldoDelMes } from './saldo'

describe('calcularSaldoDelMes', () => {
  it('sin gastos, saldo = ingreso', () => {
    expect(calcularSaldoDelMes(500000, [])).toBe(500000)
  })

  it('con gastos, saldo = ingreso - suma de gastos', () => {
    // 500000 - (30000 + 20000) = 450000
    expect(calcularSaldoDelMes(500000, [{ monto: 30000 }, { monto: 20000 }])).toBe(450000)
  })

  it('si los gastos superan el ingreso, el saldo da negativo', () => {
    expect(calcularSaldoDelMes(500000, [{ monto: 300000 }, { monto: 400000 }])).toBe(-200000)
  })
})
