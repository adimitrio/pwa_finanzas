/**
 * @vitest-environment jsdom
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import CargarGasto from './CargarGasto'
import { db } from '../db/schema'

beforeEach(async () => {
  await db.gastos.clear()
})

describe('Teclado numérico', () => {
  it('tocar 1,5,0,0 muestra "1.500"', () => {
    render(<CargarGasto onVolver={vi.fn()} />)
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

describe('Tecla 00', () => {
  it('tocar 5, 00, 00 muestra "50.000"', () => {
    render(<CargarGasto onVolver={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^5$/ }))
    const tecla00 = document.getElementById('tecla-00') as HTMLElement
    fireEvent.click(tecla00)
    fireEvent.click(tecla00)
    expect(document.getElementById('display-monto-valor')?.textContent).toBe('50.000')
  })

  it('respeta el límite de 7 dígitos', () => {
    render(<CargarGasto onVolver={vi.fn()} />)
    for (const d of ['1', '2', '3', '4', '5', '6']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${d}$`) }))
    }
    // 123.456 → "00" daría 12.345.600 (> 9.999.999): se ignora
    fireEvent.click(document.getElementById('tecla-00') as HTMLElement)
    expect(document.getElementById('display-monto-valor')?.textContent).toBe('123.456')
  })
})

describe('Categoría', () => {
  it('elegir "comida" la deja marcada como activa', () => {
    render(<CargarGasto onVolver={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /comida/i })
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Guardar', () => {
  it('llama a db.gastos.add con monto en centavos enteros (150000)', async () => {
    const spy = vi.spyOn(db.gastos, 'add')
    render(<CargarGasto onVolver={vi.fn()} />)

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
    render(<CargarGasto onVolver={vi.fn()} />)

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

  describe('esFijo y descripción', () => {
    async function guardarConCinco(preparar?: () => void) {
      render(<CargarGasto onVolver={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /^5$/ }))
      preparar?.()
      fireEvent.click(document.getElementById('btn-guardar') as HTMLElement)
      await waitFor(async () => expect(await db.gastos.count()).toBe(1))
      return (await db.gastos.toArray())[0]
    }

    it('por defecto guarda esFijo: false', async () => {
      expect((await guardarConCinco()).esFijo).toBe(false)
    })

    it('tildar "Es fijo" y guardar persiste esFijo: true', async () => {
      const gasto = await guardarConCinco(() => {
        fireEvent.click(screen.getByLabelText('Es fijo'))
      })
      expect(gasto.esFijo).toBe(true)
    })

    it('completar "Descripción" y guardar persiste ese texto', async () => {
      const gasto = await guardarConCinco(() => {
        fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: '  Luz septiembre ' } })
      })
      expect(gasto.descripcion).toBe('Luz septiembre')
    })

    it('dejar la descripción vacía guarda sin el campo', async () => {
      const gasto = await guardarConCinco(() => {
        fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: '   ' } })
      })
      expect(gasto).not.toHaveProperty('descripcion')
    })
  })

  describe('confirmación antes de volver', () => {
    // Dexie usa setTimeout internamente y se cuelga con timers falsos: acá se prueba
    // el tiempo de la UI, no la base, así que el guardado se stubbea.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      vi.spyOn(db.gastos, 'add').mockResolvedValue('id-falso')
    })
    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    async function guardar5(onVolver: () => void) {
      render(<CargarGasto onVolver={onVolver} />)
      fireEvent.click(screen.getByRole('button', { name: /^5$/ }))
      // act asíncrono (no findBy/waitFor: su setTimeout interno no vence con timers falsos)
      await act(async () => {
        fireEvent.click(document.getElementById('btn-guardar') as HTMLElement)
      })
    }

    it('inmediatamente después de guardar se ve "✓ Guardado" y todavía no se vuelve', async () => {
      const onVolver = vi.fn()
      await guardar5(onVolver)
      expect(screen.getByText('✓ Guardado')).toBeInTheDocument()
      expect(onVolver).not.toHaveBeenCalled()
    })

    it('llama a onVolver recién a los 600ms', async () => {
      const onVolver = vi.fn()
      await guardar5(onVolver)

      act(() => { vi.advanceTimersByTime(599) })
      expect(onVolver).not.toHaveBeenCalled()
      act(() => { vi.advanceTimersByTime(1) })
      expect(onVolver).toHaveBeenCalledOnce()
    })

    it('si se toca ✕ durante la confirmación, onVolver se llama una sola vez', async () => {
      const onVolver = vi.fn()
      await guardar5(onVolver)

      fireEvent.click(document.getElementById('btn-volver') as HTMLElement)
      act(() => { vi.advanceTimersByTime(1000) })
      expect(onVolver).toHaveBeenCalledOnce()
    })
  })
})
