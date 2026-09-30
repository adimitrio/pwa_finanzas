/**
 * @vitest-environment jsdom
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import CargarGasto from './CargarGasto'
import { db } from '../db/schema'

beforeEach(async () => {
  await db.gastos.clear()
})

describe('Teclado numérico', () => {
  it('tocar 1,5,0,0 muestra "1.500"', () => {
    render(<CargarGasto />)
    fireEvent.click(screen.getByRole('button', { name: /^1$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^5$/ }))
    // el botón 0 aparece dos veces (dos clicks en la misma tecla)
    const tecla0 = document.getElementById('tecla-0') as HTMLElement
    fireEvent.click(tecla0)
    fireEvent.click(tecla0)
    const display = document.getElementById('display-monto-valor') as HTMLElement
    expect(display.textContent).toBe('1.500')
  })
})

describe('Categoría', () => {
  it('elegir "comida" la deja marcada como activa', () => {
    render(<CargarGasto />)
    const btn = screen.getByRole('button', { name: /comida/i })
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Guardar', () => {
  it('llama a db.gastos.add con monto en centavos enteros (150000)', async () => {
    const spy = vi.spyOn(db.gastos, 'add')
    render(<CargarGasto />)

    // Cargar 1500 pesos → 150000 centavos
    fireEvent.click(screen.getByRole('button', { name: /^1$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^5$/ }))
    const tecla0 = document.getElementById('tecla-0') as HTMLElement
    fireEvent.click(tecla0)
    fireEvent.click(tecla0)

    fireEvent.click(document.getElementById('btn-guardar') as HTMLElement)

    await waitFor(() => expect(spy).toHaveBeenCalledOnce())

    const arg = spy.mock.calls[0][0] as { monto: number }
    expect(arg.monto).toBe(150000)
    expect(Number.isInteger(arg.monto)).toBe(true)
  })

  it('después de guardar el monto vuelve a "0"', async () => {
    render(<CargarGasto />)

    fireEvent.click(screen.getByRole('button', { name: /^1$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^5$/ }))
    const tecla0 = document.getElementById('tecla-0') as HTMLElement
    fireEvent.click(tecla0)
    fireEvent.click(tecla0)

    fireEvent.click(document.getElementById('btn-guardar') as HTMLElement)

    await waitFor(() => {
      const display = document.getElementById('display-monto-valor') as HTMLElement
      expect(display.textContent).toBe('0')
    })
  })
})
