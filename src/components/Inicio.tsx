import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { calcularSaldoDelMes } from '../logic/saldo'
import {
  obtenerPeriodoActual, calcularAsientoDeCierre, diaSiguiente, gastosDelPeriodo,
} from '../logic/periodos'

const hoy = () => new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'

// Fecha de fin por defecto al cerrar: ayer, para que el día del cierre (normalmente
// el día que se cobra) quede del lado del período nuevo.
const ayer = () => {
  const d = new Date(hoy() + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function formatARS(centavos: number): string {
  const signo = centavos < 0 ? '-' : ''
  const abs = Math.abs(centavos)
  return `${signo}$${Math.floor(abs / 100).toLocaleString('es-AR')}`
}

interface Props {
  onCargarGasto: () => void
}

export default function Inicio({ onCargarGasto }: Props) {
  // ── datos reactivos ──────────────────────────────────────────────────────
  const periodos = useLiveQuery(() => db.periodos.toArray())
  const periodo = periodos ? obtenerPeriodoActual(periodos) : null
  const periodoId = periodo?.id
  const ingresos = useLiveQuery(
    () => periodoId ? db.ingresos.where('periodoId').equals(periodoId).toArray() : [],
    [periodoId]
  ) ?? []
  const gastosFijos = useLiveQuery(() => db.gastosFijos.toArray()) ?? []
  const todosLosGastos = useLiveQuery(() => db.gastos.toArray()) ?? []
  const gastosDelMes = periodo ? gastosDelPeriodo(todosLosGastos, periodo) : []
  // actualizadoEn no está indexado (el schema no se toca): se ordena en memoria
  const ultimosGastos = [...todosLosGastos]
    .sort((x, y) => y.actualizadoEn - x.actualizadoEn)
    .slice(0, 10)

  // ── estado del primer período ────────────────────────────────────────────
  const [primerNombre, setPrimerNombre] = useState('')
  const [primerFecha, setPrimerFecha] = useState(hoy())

  // ── estado del cierre de período ─────────────────────────────────────────
  const [fechaFin, setFechaFin] = useState(ayer())
  const [nombreNuevoPeriodo, setNombreNuevoPeriodo] = useState('')
  const [errorCierre, setErrorCierre] = useState('')

  // ── estado del formulario de nuevo ingreso ───────────────────────────────
  const [ingresoNombre, setIngresoNombre] = useState('')
  const [ingresoMonto, setIngresoMonto] = useState('')

  // ── estado del formulario de nuevo gasto fijo ────────────────────────────
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoMonto, setNuevoMonto] = useState('')

  // ── cálculo de saldo ─────────────────────────────────────────────────────
  const ingresoNeto = ingresos.reduce((acc, i) => acc + i.montoNeto, 0)
  const saldo = calcularSaldoDelMes(ingresoNeto, gastosFijos, gastosDelMes)
  const totalFijosActivos = gastosFijos
    .filter(g => g.activo)
    .reduce((acc, g) => acc + g.monto, 0)
  const totalGastos = gastosDelMes.reduce((acc, g) => acc + g.monto, 0)

  // ── handlers ─────────────────────────────────────────────────────────────
  async function crearPrimerPeriodo() {
    const nombre = primerNombre.trim()
    if (!nombre || !primerFecha) return
    await db.periodos.add({
      id: crypto.randomUUID(),
      fechaInicio: primerFecha,
      nombre,
      actualizadoEn: Date.now(),
    })
  }

  async function cerrarPeriodo() {
    const nombre = nombreNuevoPeriodo.trim()
    if (!periodo || !nombre) return
    if (!fechaFin || fechaFin < periodo.fechaInicio) {
      setErrorCierre('La fecha de fin no puede ser anterior al inicio del período.')
      return
    }
    if (fechaFin > hoy()) {
      setErrorCierre('La fecha de fin no puede ser posterior a hoy.')
      return
    }
    setErrorCierre('')

    // Saldo a trasladar, para mostrarlo antes de confirmar
    const saldoPrevio = calcularSaldoDelMes(
      ingresoNeto,
      gastosFijos,
      gastosDelPeriodo(todosLosGastos, { fechaInicio: periodo.fechaInicio, fechaFin })
    )
    const ok = window.confirm(
      `Se traslada ${formatARS(saldoPrevio)} al período "${nombre}". ¿Confirmás?`
    )
    if (!ok) return

    await db.transaction(
      'rw', db.periodos, db.ingresos, db.gastos, db.gastosFijos,
      async () => {
        const nuevoId = crypto.randomUUID()
        const nuevaFechaInicio = diaSiguiente(fechaFin)
        const ahora = Date.now()

        // Saldo final del período que se cierra (fechaFin todavía sin guardar)
        const [ingresosCierre, fijosCierre, gastosTodos] = await Promise.all([
          db.ingresos.where('periodoId').equals(periodo.id).toArray(),
          db.gastosFijos.toArray(),
          db.gastos.toArray(),
        ])
        const saldoFinal = calcularSaldoDelMes(
          ingresosCierre.reduce((acc, i) => acc + i.montoNeto, 0),
          fijosCierre,
          gastosDelPeriodo(gastosTodos, { fechaInicio: periodo.fechaInicio, fechaFin })
        )
        const asiento = calcularAsientoDeCierre(saldoFinal)

        await db.periodos.update(periodo.id, { fechaFin, actualizadoEn: ahora })
        await db.periodos.add({
          id: nuevoId, fechaInicio: nuevaFechaInicio, nombre, actualizadoEn: ahora,
        })

        if (asiento.tipo === 'ingreso') {
          await db.ingresos.add({
            id: crypto.randomUUID(),
            periodoId: nuevoId,
            nombre: asiento.nombre,
            montoNeto: asiento.monto,
            actualizadoEn: ahora,
          })
        } else {
          // fecha = inicio del período nuevo: así cae dentro de su rango
          await db.gastos.add({
            id: crypto.randomUUID(),
            monto: asiento.monto,
            categoria: 'otros',
            medioPago: 'debito',
            fecha: nuevaFechaInicio,
            descripcion: asiento.descripcion,
            actualizadoEn: ahora,
          })
        }
      }
    )
    setNombreNuevoPeriodo('')
    setFechaFin(ayer())
  }

  async function agregarIngreso() {
    const nombre = ingresoNombre.trim()
    const pesos = parseInt(ingresoMonto.replace(/\D/g, ''), 10)
    if (!periodo || !nombre || isNaN(pesos) || pesos <= 0) return
    await db.ingresos.add({
      id: crypto.randomUUID(),
      periodoId: periodo.id,
      nombre,
      montoNeto: pesos * 100,
      actualizadoEn: Date.now(),
    })
    setIngresoNombre('')
    setIngresoMonto('')
  }

  async function eliminarIngreso(id: string) {
    await db.ingresos.delete(id)
  }

  async function agregarGastoFijo() {
    const nombre = nuevoNombre.trim()
    const pesos = parseInt(nuevoMonto.replace(/\D/g, ''), 10)
    if (!nombre || isNaN(pesos) || pesos <= 0) return
    await db.gastosFijos.add({
      id: crypto.randomUUID(),
      nombre,
      monto: pesos * 100,
      activo: true,
      actualizadoEn: Date.now(),
    })
    setNuevoNombre('')
    setNuevoMonto('')
  }

  async function toggleGastoFijo(id: string, activo: boolean) {
    await db.gastosFijos.update(id, { activo: !activo, actualizadoEn: Date.now() })
  }

  async function eliminarGastoFijo(id: string) {
    await db.gastosFijos.delete(id)
  }

  const saldoPositivo = saldo >= 0

  if (periodos === undefined) return null // cargando

  if (!periodo) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] flex flex-col max-w-sm mx-auto px-4 py-8 gap-4">
        <section className="bg-white rounded-3xl p-5 shadow-sm flex flex-col gap-3">
          <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest">
            Crear el primer período
          </h2>
          <input
            id="input-primer-nombre"
            type="text"
            placeholder="Nombre (ej. Octubre 2026)"
            value={primerNombre}
            onChange={e => setPrimerNombre(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <input
            id="input-primer-fecha"
            type="date"
            value={primerFecha}
            onChange={e => setPrimerFecha(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <button
            id="btn-crear-primer-periodo"
            type="button"
            onClick={() => { void crearPrimerPeriodo() }}
            className="py-2 rounded-xl bg-stone-800 text-amber-300 text-sm font-semibold hover:bg-stone-700 transition-colors"
          >
            Crear período
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] flex flex-col max-w-sm mx-auto px-4 py-8 gap-6">

      {/* ── SALDO ─────────────────────────────────────────────────────── */}
      <section className="bg-stone-800 rounded-3xl p-6 text-center shadow-xl">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2">
          Saldo · {periodo.nombre}
        </p>
        <p
          id="display-saldo"
          className={`text-5xl font-bold tracking-tight leading-none ${saldoPositivo ? 'text-amber-300' : 'text-red-400'}`}
        >
          {formatARS(saldo)}
        </p>
        <div className="mt-3 flex justify-center gap-4 text-xs text-stone-400">
          <span>Ingreso: {formatARS(ingresoNeto)}</span>
          <span>Fijos: {formatARS(totalFijosActivos)}</span>
          <span>Gastos: {formatARS(totalGastos)}</span>
        </div>
      </section>

      {/* ── BOTÓN CARGAR GASTO ────────────────────────────────────────── */}
      <button
        id="btn-ir-cargar-gasto"
        type="button"
        onClick={onCargarGasto}
        className="w-full py-4 rounded-2xl bg-amber-400 text-stone-900 text-lg font-bold shadow-lg hover:bg-amber-300 active:scale-95 transition-all duration-150"
      >
        + Cargar gasto
      </button>

      {/* ── INGRESOS ──────────────────────────────────────────────────── */}
      <section className="bg-white rounded-3xl p-5 shadow-sm flex flex-col gap-4">
        <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest">
          Ingresos
        </h2>

        {/* Ingresos del período */}
        <div className="flex flex-col gap-2">
          {ingresos.length === 0 && (
            <p className="text-xs text-stone-300 italic">Sin ingresos todavía.</p>
          )}
          {ingresos.map(i => (
            <div key={i.id} className="flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2">
              <span className="flex-1 text-sm text-stone-700 font-medium">{i.nombre}</span>
              <span className="text-sm text-stone-500">{formatARS(i.montoNeto)}</span>
              <button
                type="button"
                onClick={() => { void eliminarIngreso(i.id) }}
                aria-label={`Eliminar ingreso ${i.nombre}`}
                className="text-stone-300 hover:text-red-400 transition-colors text-base leading-none ml-1"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <input
              id="input-ingreso-nombre"
              type="text"
              placeholder="Nombre"
              value={ingresoNombre}
              onChange={e => setIngresoNombre(e.target.value)}
              className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <input
              id="input-ingreso-monto"
              type="number"
              min="1"
              placeholder="$"
              value={ingresoMonto}
              onChange={e => setIngresoMonto(e.target.value)}
              className="w-24 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button
              id="btn-agregar-ingreso"
              type="button"
              onClick={() => { void agregarIngreso() }}
              className="px-3 py-2 rounded-xl bg-stone-800 text-amber-300 text-sm font-semibold hover:bg-stone-700 transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </section>

      {/* ── GASTOS ────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-3xl p-5 shadow-sm flex flex-col gap-4">
        <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest">
          Gastos
        </h2>

        {/* Lista de gastos fijos */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-stone-500 font-medium">Fijos</p>
          {gastosFijos.length === 0 && (
            <p className="text-xs text-stone-300 italic">Sin gastos fijos todavía.</p>
          )}
          {gastosFijos.map(gf => (
            <div
              key={gf.id}
              id={`gasto-fijo-${gf.id}`}
              className="flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2"
            >
              <button
                type="button"
                onClick={() => { void toggleGastoFijo(gf.id, gf.activo) }}
                aria-pressed={gf.activo}
                aria-label={`Toggle ${gf.nombre}`}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                  gf.activo
                    ? 'bg-stone-800 border-stone-800'
                    : 'bg-white border-stone-300'
                }`}
              />
              <span className="flex-1 text-sm text-stone-700 font-medium">{gf.nombre}</span>
              <span className="text-sm text-stone-500">{formatARS(gf.monto)}</span>
              <button
                type="button"
                onClick={() => { void eliminarGastoFijo(gf.id) }}
                aria-label={`Eliminar ${gf.nombre}`}
                className="text-stone-300 hover:text-red-400 transition-colors text-base leading-none ml-1"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Formulario agregar gasto fijo */}
          <div className="flex gap-2 mt-1">
            <input
              id="input-nuevo-nombre"
              type="text"
              placeholder="Nombre"
              value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <input
              id="input-nuevo-monto"
              type="number"
              min="1"
              placeholder="$"
              value={nuevoMonto}
              onChange={e => setNuevoMonto(e.target.value)}
              className="w-24 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button
              id="btn-agregar-gasto-fijo"
              type="button"
              onClick={() => { void agregarGastoFijo() }}
              className="px-3 py-2 rounded-xl bg-stone-800 text-amber-300 text-sm font-semibold hover:bg-stone-700 transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Últimos gastos */}
        <div className="flex flex-col gap-3">
          <p className="text-xs text-stone-500 font-medium">Últimos</p>
          {ultimosGastos.length === 0 && (
            <p className="text-xs text-stone-300 italic">Sin gastos registrados.</p>
          )}
          {ultimosGastos.map(g => (
            <div
              key={g.id}
              className="flex items-center justify-between text-sm border-b border-stone-50 pb-2 last:border-0 last:pb-0"
            >
              <div className="flex flex-col">
                <span className="text-stone-700 font-medium capitalize">{g.categoria}</span>
                <span className="text-xs text-stone-400 capitalize">{g.medioPago} · {g.fecha}</span>
              </div>
              <span className="font-semibold text-stone-800">{formatARS(g.monto)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CERRAR PERÍODO ────────────────────────────────────────────── */}
      <section className="bg-stone-800 rounded-3xl p-5 shadow-xl flex flex-col gap-3">
        <h2 className="text-sm font-bold text-stone-100 uppercase tracking-widest">
          Cerrar {periodo.nombre}
        </h2>
        <p className="text-xs text-stone-400">
          Acción poco frecuente y sin vuelta atrás: el saldo pasa al período nuevo.
        </p>
        <label htmlFor="input-fecha-fin" className="text-xs text-stone-400 font-medium">
          Fecha de fin
        </label>
        <input
          id="input-fecha-fin"
          type="date"
          value={fechaFin}
          onChange={e => setFechaFin(e.target.value)}
          className="rounded-xl border border-stone-600 bg-stone-700 px-3 py-2 text-sm text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
        <input
          id="input-nombre-periodo"
          type="text"
          placeholder="Nombre del período nuevo"
          value={nombreNuevoPeriodo}
          onChange={e => setNombreNuevoPeriodo(e.target.value)}
          className="rounded-xl border border-stone-600 bg-stone-700 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
        {errorCierre && (
          <p id="error-cierre" role="alert" className="text-xs text-red-400">
            {errorCierre}
          </p>
        )}
        <button
          id="btn-cerrar-periodo"
          type="button"
          onClick={() => { void cerrarPeriodo() }}
          className="py-2 rounded-xl bg-stone-100 text-stone-800 text-sm font-bold hover:bg-white transition-colors"
        >
          Cerrar período
        </button>
      </section>
    </main>
  )
}
