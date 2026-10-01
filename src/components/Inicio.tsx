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

function Chevron({ abierto }: { abierto: boolean }) {
  return (
    <svg
      aria-hidden="true" viewBox="0 0 20 20" width="18" height="18"
      className={`text-stone-400 transition-transform ${abierto ? 'rotate-180' : ''}`}
    >
      <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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
  const todosLosGastos = useLiveQuery(() => db.gastos.toArray()) ?? []
  const gastosDelMes = periodo ? gastosDelPeriodo(todosLosGastos, periodo) : []
  const fijosDelMes = gastosDelMes.filter(g => g.esFijo)
  // actualizadoEn no está indexado (el schema no se toca): se ordena en memoria
  const ultimosGastos = [...gastosDelMes]
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

  // ── tarjetas colapsables (solo en memoria) ───────────────────────────────
  const [ingresosAbierto, setIngresosAbierto] = useState(false)
  const [gastosAbierto, setGastosAbierto] = useState(false)

  // ── cálculo de saldo ─────────────────────────────────────────────────────
  const ingresoNeto = ingresos.reduce((acc, i) => acc + i.montoNeto, 0)
  const saldo = calcularSaldoDelMes(ingresoNeto, gastosDelMes)
  const totalGastos = gastosDelMes.reduce((acc, g) => acc + g.monto, 0)
  const totalFijos = fijosDelMes.reduce((acc, g) => acc + g.monto, 0)

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
      gastosDelPeriodo(todosLosGastos, { fechaInicio: periodo.fechaInicio, fechaFin })
    )
    const ok = window.confirm(
      `Se traslada ${formatARS(saldoPrevio)} al período "${nombre}". ¿Confirmás?`
    )
    if (!ok) return

    await db.transaction(
      'rw', db.periodos, db.ingresos, db.gastos,
      async () => {
        const nuevoId = crypto.randomUUID()
        const nuevaFechaInicio = diaSiguiente(fechaFin)
        const ahora = Date.now()

        // Saldo final del período que se cierra (fechaFin todavía sin guardar)
        const [ingresosCierre, gastosTodos] = await Promise.all([
          db.ingresos.where('periodoId').equals(periodo.id).toArray(),
          db.gastos.toArray(),
        ])
        const saldoFinal = calcularSaldoDelMes(
          ingresosCierre.reduce((acc, i) => acc + i.montoNeto, 0),
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
            esFijo: false,
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

  const saldoPositivo = saldo >= 0

  if (periodos === undefined) return null // cargando

  if (!periodo) {
    return (
      <main className="min-h-screen bg-fondo flex flex-col max-w-sm mx-auto px-4 py-8 gap-4">
        <section className="bg-white border border-borde rounded-md p-5 shadow-sm flex flex-col gap-3">
          <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest">
            Crear el primer período
          </h2>
          <input
            id="input-primer-nombre"
            type="text"
            placeholder="Nombre (ej. Octubre 2026)"
            value={primerNombre}
            onChange={e => setPrimerNombre(e.target.value)}
            className="rounded-sm border border-borde px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-acento"
          />
          <input
            id="input-primer-fecha"
            type="date"
            value={primerFecha}
            onChange={e => setPrimerFecha(e.target.value)}
            className="rounded-sm border border-borde px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-acento"
          />
          <button
            id="btn-crear-primer-periodo"
            type="button"
            onClick={() => { void crearPrimerPeriodo() }}
            className="py-2 rounded-sm bg-tarjeta-oscura text-acento text-sm font-semibold hover:brightness-125 transition-colors"
          >
            Crear período
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-fondo flex flex-col max-w-sm mx-auto px-4 py-8 gap-6">

      {/* ── SALDO ─────────────────────────────────────────────────────── */}
      <section className="bg-tarjeta-oscura rounded-md p-6 text-center shadow-xl">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2">
          Saldo · {periodo.nombre}
        </p>
        <p
          id="display-saldo"
          className={`font-display font-semibold tabular-nums text-5xl tracking-tight leading-none ${saldoPositivo ? 'text-acento' : 'text-red-400'}`}
        >
          {formatARS(saldo)}
        </p>
        <div className="mt-3 flex justify-center gap-4 text-xs text-stone-400">
          <span>Ingreso: {formatARS(ingresoNeto)}</span>
          <span>Gastos: {formatARS(totalGastos)}</span>
        </div>
      </section>

      {/* ── BOTÓN CARGAR GASTO ────────────────────────────────────────── */}
      <button
        id="btn-ir-cargar-gasto"
        type="button"
        onClick={onCargarGasto}
        className="w-full py-4 rounded-md bg-acento text-stone-900 text-lg font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all duration-150"
      >
        + Cargar gasto
      </button>

      {/* ── INGRESOS ──────────────────────────────────────────────────── */}
      <section className="bg-white border border-borde rounded-md p-5 shadow-sm flex flex-col gap-4">
        <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest">
          <button
            id="toggle-ingresos"
            type="button"
            aria-expanded={ingresosAbierto}
            onClick={() => setIngresosAbierto(a => !a)}
            className="flex w-full items-center justify-between uppercase tracking-widest"
          >
            Ingresos
            <Chevron abierto={ingresosAbierto} />
          </button>
        </h2>

        {ingresosAbierto && (
          <div className="flex flex-col gap-2">
            {ingresos.length === 0 && (
              <p className="text-xs text-stone-300 italic">Sin ingresos todavía.</p>
            )}
            {ingresos.map(i => (
              <div key={i.id} className="flex items-center gap-2 bg-stone-50 rounded-sm px-3 py-2">
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
                className="flex-1 rounded-sm border border-borde px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-acento"
              />
              <input
                id="input-ingreso-monto"
                type="number"
                min="1"
                placeholder="$"
                value={ingresoMonto}
                onChange={e => setIngresoMonto(e.target.value)}
                className="w-24 rounded-sm border border-borde px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-acento"
              />
              <button
                id="btn-agregar-ingreso"
                type="button"
                onClick={() => { void agregarIngreso() }}
                className="px-3 py-2 rounded-sm bg-tarjeta-oscura text-acento text-sm font-semibold hover:brightness-125 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── GASTOS ────────────────────────────────────────────────────── */}
      <section className="bg-white border border-borde rounded-md p-5 shadow-sm flex flex-col gap-4">
        <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest">
          <button
            id="toggle-gastos"
            type="button"
            aria-expanded={gastosAbierto}
            onClick={() => setGastosAbierto(a => !a)}
            className="flex w-full items-center justify-between uppercase tracking-widest"
          >
            Gastos
            <Chevron abierto={gastosAbierto} />
          </button>
        </h2>

        {gastosAbierto && (
          <>
            {/* Fijos: solo lectura, gastos del período con esFijo */}
            <div id="gastos-fijos" className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-stone-500 font-medium">Fijos</p>
                <span id="total-fijos" className="text-xs font-semibold text-stone-500">
                  {formatARS(totalFijos)}
                </span>
              </div>
              {fijosDelMes.length === 0 && (
                <p className="text-xs text-stone-300 italic">Sin gastos fijos en este período.</p>
              )}
              {fijosDelMes.map(g => (
                <div key={g.id} className="flex items-center gap-2 bg-stone-50 rounded-sm px-3 py-2">
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm text-stone-700 font-medium">
                      {g.descripcion ?? <span className="capitalize">{g.categoria}</span>}
                    </span>
                    <span className="text-xs text-stone-400">{g.fecha}</span>
                  </div>
                  <span className="text-sm text-stone-500">{formatARS(g.monto)}</span>
                </div>
              ))}
            </div>

            {/* Últimos gastos del período */}
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
                    <span className="text-stone-700 font-medium capitalize">
                      {g.categoria}
                      {g.esFijo && (
                        <span className="ml-2 rounded-sm border border-acento px-1 text-[10px] font-semibold uppercase tracking-wide text-acento">
                          Fijo
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-stone-400 capitalize">{g.medioPago} · {g.fecha}</span>
                  </div>
                  <span className="font-semibold text-stone-800">{formatARS(g.monto)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── CERRAR PERÍODO ────────────────────────────────────────────── */}
      <section className="bg-tarjeta-oscura rounded-md p-5 shadow-xl flex flex-col gap-3">
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
          className="rounded-sm border border-stone-600 bg-stone-700 px-3 py-2 text-sm text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
        <input
          id="input-nombre-periodo"
          type="text"
          placeholder="Nombre del período nuevo"
          value={nombreNuevoPeriodo}
          onChange={e => setNombreNuevoPeriodo(e.target.value)}
          className="rounded-sm border border-stone-600 bg-stone-700 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
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
          className="py-2 rounded-md bg-stone-100 text-stone-800 text-sm font-bold hover:bg-white transition-colors"
        >
          Cerrar período
        </button>
      </section>
    </main>
  )
}
