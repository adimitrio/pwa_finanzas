/**
 * @vitest-environment jsdom
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Inicio from './Inicio'
import { db } from '../db/schema'
import { diaSiguiente, gastosDelPeriodo } from '../logic/periodos'
import * as descargarMod from '../lib/descargar'

const HOY = new Date().toISOString().slice(0, 10)
const PERIODO_ID = 'periodo-1'

const dia = (base: string, delta: number) => {
  const d = new Date(base + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

async function crearPeriodo(fechaInicio = '2020-01-01', id = PERIODO_ID) {
  await db.periodos.add({ id, fechaInicio, nombre: 'Viejo', actualizadoEn: Date.now() })
}

async function agregarIngreso(montoNeto: number, periodoId = PERIODO_ID) {
  await db.ingresos.add({
    id: crypto.randomUUID(), periodoId, nombre: 'Sueldo', montoNeto, actualizadoEn: Date.now(),
  })
}

async function agregarGasto(
  monto: number,
  fecha = HOY,
  id: string = crypto.randomUUID(),
  extra: { descripcion?: string } = {}
) {
  await db.gastos.add({
    id, monto, categoria: 'super', fecha,
    actualizadoEn: Date.now(), ...extra,
  })
}

const expandir = (id: 'toggle-ingresos' | 'toggle-gastos') =>
  fireEvent.click(document.getElementById(id) as HTMLElement)

const porId = (id: string) =>
  waitFor(() => {
    const el = document.getElementById(id)
    if (!el) throw new Error(`falta #${id}`)
    return el
  })

const tituloSaldo = () => document.getElementById('display-saldo')?.parentElement

const saldoEnPantalla = () => document.getElementById('display-saldo')

function cerrarPeriodoUI(nombre: string, fechaFin?: string) {
  if (fechaFin) {
    fireEvent.change(document.getElementById('input-fecha-fin') as HTMLElement, {
      target: { value: fechaFin },
    })
  }
  fireEvent.change(document.getElementById('input-nombre-periodo') as HTMLElement, {
    target: { value: nombre },
  })
  fireEvent.click(document.getElementById('btn-cerrar-periodo') as HTMLElement)
}

beforeEach(async () => {
  await db.gastos.clear()
  await db.ingresos.clear()
  await db.periodos.clear()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Inicio', () => {
  it('muestra el saldo: fijos y gastos comunes descuentan por igual, y solo los del período', async () => {
    await crearPeriodo('2026-01-01')
    await agregarIngreso(50000000)
    await agregarGasto(10000000, '2026-03-05') // alquiler
    await agregarGasto(2000000, '2026-03-10')
    // anterior al inicio del período: no cuenta
    await agregarGasto(9999900, '2025-12-31')

    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)

    // 500.000 - 100.000 - 20.000 = 380.000
    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('$380.000'))
  })

  it('agregar un ingreso lo persiste en el período actual y suma al saldo', async () => {
    await crearPeriodo()
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('toggle-ingresos')
    expandir('toggle-ingresos')

    fireEvent.change(await porId('input-ingreso-nombre'), { target: { value: 'Bono' } })
    fireEvent.change(document.getElementById('input-ingreso-monto') as HTMLElement, {
      target: { value: '1000' },
    })
    fireEvent.click(document.getElementById('btn-agregar-ingreso') as HTMLElement)

    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('$1.000'))
    const ingresos = await db.ingresos.toArray()
    expect(ingresos).toHaveLength(1)
    expect(ingresos[0]).toMatchObject({ periodoId: PERIODO_ID, nombre: 'Bono', montoNeto: 100000 })
  })

  it('tocar el encabezado de "Ingresos" o "Gastos" alterna si el contenido se ve', async () => {
    await crearPeriodo()
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('toggle-ingresos')

    // arrancan colapsadas
    expect(document.getElementById('input-ingreso-nombre')).toBeNull()
    expect(document.getElementById('toggle-ingresos')).toHaveAttribute('aria-expanded', 'false')

    expandir('toggle-ingresos')
    expect(document.getElementById('input-ingreso-nombre')).not.toBeNull()
    expect(document.getElementById('toggle-ingresos')).toHaveAttribute('aria-expanded', 'true')
    expandir('toggle-ingresos')
    expect(document.getElementById('input-ingreso-nombre')).toBeNull()

    expandir('toggle-gastos')
    expect(document.getElementById('toggle-gastos')).toHaveAttribute('aria-expanded', 'true')
    expandir('toggle-gastos')
    expect(document.getElementById('toggle-gastos')).toHaveAttribute('aria-expanded', 'false')
  })

  it('las tarjetas quedan agrupadas: Ingresos, Gastos y Cerrar período', async () => {
    await crearPeriodo()
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('display-saldo')

    const titulos = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    expect(titulos).toEqual(['Ingresos', 'Gastos', 'Cerrar Viejo'])
  })

  it('sin períodos muestra el formulario y crea el primero sin asiento de cierre', async () => {
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    fireEvent.change(await porId('input-primer-nombre'), { target: { value: 'Septiembre 2026' } })
    fireEvent.change(document.getElementById('input-primer-fecha') as HTMLElement, {
      target: { value: '2026-09-01' },
    })
    fireEvent.click(document.getElementById('btn-crear-primer-periodo') as HTMLElement)

    await waitFor(() => expect(saldoEnPantalla()).toBeInTheDocument())
    const periodos = await db.periodos.toArray()
    expect(periodos).toHaveLength(1)
    expect(periodos[0]).toMatchObject({ nombre: 'Septiembre 2026', fechaInicio: '2026-09-01' })
    expect(await db.ingresos.count()).toBe(0)
    expect(await db.gastos.count()).toBe(0)
  })

  it('tocar una fila de gasto llama a onEditarGasto con ese gasto', async () => {
    await crearPeriodo('2026-01-01')
    const id = crypto.randomUUID()
    await agregarGasto(500000, '2026-03-10', id)
    const onEditar = vi.fn()
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={onEditar} />)
    await porId('toggle-gastos')
    expandir('toggle-gastos')

    const fila = await waitFor(() => {
      const btn = document.querySelector('[aria-label*="super"]') as HTMLElement
      if (!btn) throw new Error('falta fila')
      return btn
    })
    fireEvent.click(fila)
    expect(onEditar).toHaveBeenCalledOnce()
    expect(onEditar.mock.calls[0][0].id).toBe(id)
  })

  it('con más de 10 gastos en el período, se listan todos', async () => {
    await crearPeriodo('2026-01-01')
    for (let i = 0; i < 12; i++) {
      await agregarGasto(100000, '2026-03-10')
    }
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('toggle-gastos')
    expandir('toggle-gastos')

    await waitFor(() => {
      const filas = document.querySelectorAll('[aria-label*="Editar gasto"]')
      expect(filas.length).toBe(12)
    })
  })

  it('el orden de gastos es por fecha descendente', async () => {
    await crearPeriodo('2026-01-01')
    await agregarGasto(100000, '2026-03-01', 'g-viejo')
    await agregarGasto(200000, '2026-03-20', 'g-nuevo')
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('toggle-gastos')
    expandir('toggle-gastos')

    await waitFor(() => {
      const filas = document.querySelectorAll('[aria-label*="Editar gasto"]')
      expect(filas.length).toBe(2)
      // el más reciente va primero
      expect((filas[0] as HTMLElement).getAttribute('aria-label')).toContain('$2.000')
      expect((filas[1] as HTMLElement).getAttribute('aria-label')).toContain('$1.000')
    })
  })

  it('tras editar el monto de un gasto, el saldo se recalcula reactivamente', async () => {
    await crearPeriodo('2026-01-01')
    await agregarIngreso(10000000)
    const id = 'g-editar'
    await agregarGasto(1000000, '2026-03-10', id)
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('$90.000'))

    // Editar el gasto directamente en la base (simula lo que haría CargarGasto en modo edición)
    await db.gastos.put({
      id, monto: 2000000, categoria: 'super',
      fecha: '2026-03-10', actualizadoEn: Date.now(),
    })

    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('$80.000'))
  })

  it('tras eliminar un gasto, desaparece de la lista y del saldo', async () => {
    await crearPeriodo('2026-01-01')
    await agregarIngreso(10000000)
    const id = 'g-eliminar'
    await agregarGasto(1000000, '2026-03-10', id)
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('$90.000'))

    await db.gastos.delete(id)

    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('$100.000'))
  })
})

describe('Exportar CSV', () => {
  it('el botón "Exportar ingresos y gastos" abre el panel con el período actual preseleccionado', async () => {
    await crearPeriodo()
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('btn-exportar-gastos')

    expect(document.getElementById('panel-exportar')).toBeNull()
    fireEvent.click(document.getElementById('btn-exportar-gastos') as HTMLElement)

    const panel = await porId('panel-exportar')
    expect(panel).not.toBeNull()
    const select = document.getElementById('select-periodo-exportar') as HTMLSelectElement
    expect(select.value).toBe(PERIODO_ID)
  })

  it('cambiar el período cambia el conteo', async () => {
    await crearPeriodo('2026-01-01', PERIODO_ID)
    const otroPeriodoId = 'p-otro'
    await db.periodos.add({ id: otroPeriodoId, fechaInicio: '2026-10-01', nombre: 'Octubre 2026', actualizadoEn: Date.now() })
    // gasto en el período actual
    await agregarGasto(100000, '2026-03-10')
    // gasto en el otro período
    await agregarIngreso(500000, otroPeriodoId)
    await db.gastos.add({ id: 'g-otro', monto: 200000, categoria: 'super', fecha: '2026-10-10', actualizadoEn: Date.now() })

    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('btn-exportar-gastos')
    fireEvent.click(document.getElementById('btn-exportar-gastos') as HTMLElement)
    await porId('panel-exportar')

    // Período actual (Octubre): 1 ingreso y 1 gasto (singular)
    await waitFor(() => {
      expect(document.getElementById('conteo-gastos-exportar')).toHaveTextContent('1 ingreso y 1 gasto')
    })

    // Cambiar al período viejo: sin ingresos
    fireEvent.change(document.getElementById('select-periodo-exportar') as HTMLElement, {
      target: { value: PERIODO_ID },
    })
    await waitFor(() => {
      expect(document.getElementById('conteo-gastos-exportar')).toHaveTextContent('0 ingresos y')
    })
  })

  it('"Descargar CSV" llama a descargarArchivo con nombre y contenido esperados', async () => {
    const spy = vi.spyOn(descargarMod, 'descargarArchivo').mockImplementation(() => {})
    await crearPeriodo('2026-01-01', PERIODO_ID)
    await db.periodos.clear()
    await db.periodos.add({ id: PERIODO_ID, fechaInicio: '2026-01-01', nombre: 'Enero 2026', actualizadoEn: Date.now() })
    await agregarGasto(100000, '2026-01-10')
    await agregarIngreso(250000000)

    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('btn-exportar-gastos')
    fireEvent.click(document.getElementById('btn-exportar-gastos') as HTMLElement)
    await porId('btn-descargar-csv')
    fireEvent.click(document.getElementById('btn-descargar-csv') as HTMLElement)

    await waitFor(() => expect(spy).toHaveBeenCalledOnce())
    const [nombre, contenido, mime] = spy.mock.calls[0]
    expect(nombre).toBe('movimientos-enero-2026.csv')
    expect(contenido).toContain('tipo,fecha,monto,categoria,descripcion,periodo')
    expect(contenido).toContain('ingreso,2026-01-01,2500000.00,,Sueldo,Enero 2026')
    expect(mime).toContain('text/csv')
  })

  it('período con solo ingresos → botón habilitado', async () => {
    await crearPeriodo()
    await agregarIngreso(100000)
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('btn-exportar-gastos')
    fireEvent.click(document.getElementById('btn-exportar-gastos') as HTMLElement)
    await porId('panel-exportar')

    await waitFor(() => {
      expect(document.getElementById('conteo-gastos-exportar')).toHaveTextContent('1 ingreso y 0 gastos')
    })
    expect(document.getElementById('btn-descargar-csv')).toBeEnabled()
  })

  it('período vacío → botón deshabilitado y texto descriptivo', async () => {
    await crearPeriodo()
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('btn-exportar-gastos')
    fireEvent.click(document.getElementById('btn-exportar-gastos') as HTMLElement)
    await porId('panel-exportar')

    await waitFor(() => {
      expect(document.getElementById('conteo-gastos-exportar')).toHaveTextContent('Este período no tiene movimientos')
    })
    expect(document.getElementById('btn-descargar-csv')).toBeDisabled()
  })
})

describe('Cerrar período', () => {
  it('con fecha de fin = hoy y saldo positivo crea el período nuevo y un ingreso "Saldo mes anterior"', async () => {
    await crearPeriodo()
    await agregarIngreso(50000000)
    await agregarGasto(2000000)
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('$480.000'))

    cerrarPeriodoUI('Octubre 2026', HOY)

    await waitFor(async () => expect(await db.periodos.count()).toBe(2))
    const nuevo = (await db.periodos.toArray()).find(p => p.id !== PERIODO_ID)!
    expect(nuevo).toMatchObject({ nombre: 'Octubre 2026', fechaInicio: diaSiguiente(HOY) })
    expect(nuevo.fechaFin).toBeUndefined()
    expect((await db.periodos.get(PERIODO_ID))?.fechaFin).toBe(HOY)
    const ingresosNuevos = await db.ingresos.where('periodoId').equals(nuevo.id).toArray()
    expect(ingresosNuevos).toHaveLength(1)
    expect(ingresosNuevos[0]).toMatchObject({ nombre: 'Saldo mes anterior', montoNeto: 48000000 })
  })

  it('con saldo negativo crea un gasto "Deuda mes anterior" dentro del período nuevo', async () => {
    await crearPeriodo()
    await agregarIngreso(1000000)
    await agregarGasto(3000000, dia(HOY, -1))
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('-$20.000'))

    cerrarPeriodoUI('Octubre 2026')

    await waitFor(() => expect(tituloSaldo()).toHaveTextContent('Octubre 2026'))
    const nuevo = (await db.periodos.toArray()).find(p => p.id !== PERIODO_ID)!
    const deuda = (await db.gastos.toArray()).find(g => g.descripcion === 'Deuda mes anterior')!
    expect(deuda).toMatchObject({ monto: 2000000, categoria: 'otros' })
    expect(deuda).not.toHaveProperty('periodoId')
    expect(deuda.fecha).toBe(nuevo.fechaInicio) // no "hoy": cae dentro de su propio período
    expect(gastosDelPeriodo([deuda], nuevo)).toHaveLength(1)
    expect(await db.ingresos.where('periodoId').equals(nuevo.id).count()).toBe(0)
    // en pantalla el período nuevo arranca debiendo lo trasladado
    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('-$20.000'))
  })

  it('el saldo mostrado arranca en el valor trasladado', async () => {
    await crearPeriodo()
    await agregarIngreso(50000000)
    await agregarGasto(2000000, dia(HOY, -1))
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('$480.000'))

    cerrarPeriodoUI('Octubre 2026')

    await waitFor(() => expect(tituloSaldo()).toHaveTextContent('Octubre 2026'))
    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('$480.000'))
  })

  it('la fecha de fin viene por defecto en ayer y un gasto de hoy queda en el período nuevo', async () => {
    await crearPeriodo()
    await agregarIngreso(50000000)
    await agregarGasto(2000000) // hoy
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('$480.000'))
    expect(await porId('input-fecha-fin')).toHaveValue(dia(HOY, -1))

    cerrarPeriodoUI('Octubre 2026')

    await waitFor(() => expect(tituloSaldo()).toHaveTextContent('Octubre 2026'))
    const nuevo = (await db.periodos.toArray()).find(p => p.id !== PERIODO_ID)!
    expect(nuevo.fechaInicio).toBe(HOY)
    // el gasto de hoy no entra en el saldo trasladado: se traslada el ingreso completo
    const traslado = await db.ingresos.where('periodoId').equals(nuevo.id).toArray()
    expect(traslado[0]).toMatchObject({ nombre: 'Saldo mes anterior', montoNeto: 50000000 })
    // y sí descuenta en el período nuevo: 500.000 - 20.000
    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('$480.000'))
  })

  it('si el período empezó hoy, el cierre por defecto (ayer) da error hasta editar la fecha', async () => {
    await crearPeriodo(HOY)
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('input-fecha-fin')

    cerrarPeriodoUI('Octubre 2026')

    expect(await screen.findByRole('alert')).toHaveTextContent(/anterior al inicio/i)
    expect(await db.periodos.count()).toBe(1)
  })

  it('no hace nada si el usuario cancela el confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await crearPeriodo()
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('input-fecha-fin')

    cerrarPeriodoUI('Octubre 2026')

    await new Promise(r => setTimeout(r, 50))
    expect(await db.periodos.count()).toBe(1)
  })

  it('con fecha de fin pasada, el gasto posterior queda en el período nuevo sin ningún paso extra', async () => {
    const fin = dia(HOY, -2)
    await crearPeriodo()
    await agregarIngreso(50000000)
    await agregarGasto(1000000, dia(HOY, -3), 'g-antes')
    await agregarGasto(500000, dia(HOY, -1), 'g-despues')
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('$485.000'))

    cerrarPeriodoUI('Octubre 2026', fin)

    await waitFor(() => expect(tituloSaldo()).toHaveTextContent('Octubre 2026'))
    const periodos = await db.periodos.toArray()
    const viejo = periodos.find(p => p.id === PERIODO_ID)!
    const nuevo = periodos.find(p => p.id !== PERIODO_ID)!
    expect(viejo.fechaFin).toBe(fin)
    expect(nuevo.fechaInicio).toBe(dia(HOY, -1))

    // pertenencia calculada solo por fecha; los gastos no se modificaron
    const gastos = await db.gastos.toArray()
    expect(gastosDelPeriodo(gastos, viejo).map(g => g.id)).toEqual(['g-antes'])
    expect(gastosDelPeriodo(gastos, nuevo).map(g => g.id)).toEqual(['g-despues'])

    // el saldo trasladado excluye el gasto posterior: 500.000 - 10.000 = 490.000
    const traslado = await db.ingresos.where('periodoId').equals(nuevo.id).toArray()
    expect(traslado).toHaveLength(1)
    expect(traslado[0]).toMatchObject({ nombre: 'Saldo mes anterior', montoNeto: 49000000 })
    // y el período nuevo muestra 490.000 - 5.000 = 485.000
    await waitFor(() => expect(saldoEnPantalla()).toHaveTextContent('$485.000'))
  })

  it('con fecha de fin futura muestra error y no ejecuta nada', async () => {
    await crearPeriodo()
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('input-fecha-fin')

    cerrarPeriodoUI('Octubre 2026', dia(HOY, 1))

    expect(await screen.findByRole('alert')).toHaveTextContent(/posterior a hoy/i)
    expect(window.confirm).not.toHaveBeenCalled()
    expect(await db.periodos.count()).toBe(1)
  })

  it('con fecha de fin anterior al inicio del período muestra error y no ejecuta nada', async () => {
    await crearPeriodo('2026-09-10')
    render(<Inicio onCargarGasto={vi.fn()} onEditarGasto={vi.fn()} />)
    await porId('input-fecha-fin')

    cerrarPeriodoUI('Octubre 2026', '2026-09-09')

    expect(await screen.findByRole('alert')).toHaveTextContent(/anterior al inicio/i)
    expect(window.confirm).not.toHaveBeenCalled()
    expect(await db.periodos.count()).toBe(1)
    expect((await db.periodos.get(PERIODO_ID))?.fechaFin).toBeUndefined()
  })
})
