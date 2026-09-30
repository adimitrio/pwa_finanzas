/**
 * @vitest-environment jsdom
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Inicio from './Inicio'
import { db } from '../db/schema'

const MES = new Date().toISOString().slice(0, 7)

beforeEach(async () => {
  await db.gastos.clear()
  await db.gastosFijos.clear()
  await db.ingresos.clear()
})

describe('Inicio', () => {
  it('muestra el saldo calculado con ingreso, fijos activos y gastos', async () => {
    await db.ingresos.add({
      id: crypto.randomUUID(), mes: MES, montoNeto: 50000000, actualizadoEn: Date.now(),
    })
    await db.gastosFijos.add({
      id: crypto.randomUUID(), nombre: 'Alquiler', monto: 10000000, activo: true, actualizadoEn: Date.now(),
    })
    await db.gastosFijos.add({
      id: crypto.randomUUID(), nombre: 'Gym', monto: 5000000, activo: false, actualizadoEn: Date.now(),
    })
    await db.gastos.add({
      id: crypto.randomUUID(), monto: 2000000, categoria: 'super', medioPago: 'debito',
      fecha: `${MES}-05`, actualizadoEn: Date.now(),
    })

    render(<Inicio onCargarGasto={vi.fn()} />)

    // 500.000 - 100.000 - 20.000 = 380.000
    await waitFor(() =>
      expect(document.getElementById('display-saldo')).toHaveTextContent('$380.000')
    )
  })

  it('guardar el ingreso dos veces deja un solo registro para el mes', async () => {
    render(<Inicio onCargarGasto={vi.fn()} />)
    const input = document.getElementById('input-ingreso') as HTMLInputElement
    const guardar = document.getElementById('btn-guardar-ingreso') as HTMLElement

    fireEvent.change(input, { target: { value: '1000' } })
    fireEvent.click(guardar)
    await waitFor(async () => expect(await db.ingresos.count()).toBe(1))

    fireEvent.change(input, { target: { value: '2000' } })
    fireEvent.click(guardar)
    await waitFor(async () => {
      const registros = await db.ingresos.where('mes').equals(MES).toArray()
      expect(registros).toHaveLength(1)
      expect(registros[0].montoNeto).toBe(200000)
    })
  })

  it('agregar un gasto fijo lo persiste y aparece en la lista', async () => {
    render(<Inicio onCargarGasto={vi.fn()} />)
    fireEvent.change(document.getElementById('input-nuevo-nombre') as HTMLElement, {
      target: { value: 'Internet' },
    })
    fireEvent.change(document.getElementById('input-nuevo-monto') as HTMLElement, {
      target: { value: '15000' },
    })
    fireEvent.click(document.getElementById('btn-agregar-gasto-fijo') as HTMLElement)

    expect(await screen.findByText('Internet')).toBeInTheDocument()
    const guardados = await db.gastosFijos.toArray()
    expect(guardados).toHaveLength(1)
    expect(guardados[0]).toMatchObject({ nombre: 'Internet', monto: 1500000, activo: true })
  })
})
