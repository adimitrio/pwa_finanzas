import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db, type Gasto, type Ingreso } from './schema'

beforeEach(async () => {
  await db.gastos.clear()
  await db.ingresos.clear()
  await db.periodos.clear()
})

describe('Gasto', () => {
  it('guarda y lee un Gasto exactamente', async () => {
    const gasto: Gasto = {
      id: crypto.randomUUID(),
      monto: 150000,
      categoria: 'super',
      medioPago: 'debito',
      fecha: '2024-09-15',
      esFijo: false,
      actualizadoEn: Date.now(),
    }

    await db.gastos.add(gasto)
    const leido = await db.gastos.get(gasto.id)

    expect(leido).toEqual(gasto)
  })
})

describe('Ingreso', () => {
  it('guarda y lee un Ingreso exactamente', async () => {
    const ingreso: Ingreso = {
      id: crypto.randomUUID(),
      periodoId: 'p1',
      nombre: 'Sueldo',
      montoNeto: 180000000,
      actualizadoEn: Date.now(),
    }

    await db.ingresos.add(ingreso)
    const leido = await db.ingresos.get(ingreso.id)

    expect(leido).toEqual(ingreso)
  })
})

describe('Consulta por índice', () => {
  it('filtra gastos por fecha correctamente', async () => {
    const gastoA: Gasto = {
      id: crypto.randomUUID(),
      monto: 100000,
      categoria: 'comida',
      medioPago: 'efectivo',
      fecha: '2024-09-01',
      esFijo: false,
      actualizadoEn: Date.now(),
    }
    const gastoB: Gasto = {
      id: crypto.randomUUID(),
      monto: 200000,
      categoria: 'transporte',
      medioPago: 'debito',
      fecha: '2024-09-15',
      esFijo: false,
      actualizadoEn: Date.now(),
    }

    await db.gastos.add(gastoA)
    await db.gastos.add(gastoB)

    const resultado = await db.gastos.where('fecha').equals('2024-09-01').toArray()

    expect(resultado).toHaveLength(1)
    expect(resultado[0].id).toBe(gastoA.id)
  })
})
