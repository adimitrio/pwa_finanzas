import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { calcularSaldoDelMes } from '../logic/saldo'

const MES_ACTUAL = new Date().toISOString().slice(0, 7) // 'YYYY-MM'

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
  const ingreso = useLiveQuery(() =>
    db.ingresos.where('mes').equals(MES_ACTUAL).first()
  )
  const gastosFijos = useLiveQuery(() => db.gastosFijos.toArray()) ?? []
  const gastosDelMes = useLiveQuery(() =>
    db.gastos.where('fecha').startsWith(MES_ACTUAL).toArray()
  ) ?? []
  const ultimosGastos = useLiveQuery(() =>
    // actualizadoEn no está indexado (el schema no se toca): se ordena en memoria
    db.gastos.toArray().then(gs =>
      gs.sort((a, b) => b.actualizadoEn - a.actualizadoEn).slice(0, 10)
    )
  ) ?? []

  // ── estado del formulario de ingreso ─────────────────────────────────────
  const [inputIngreso, setInputIngreso] = useState('')

  // ── estado del formulario de nuevo gasto fijo ────────────────────────────
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoMonto, setNuevoMonto] = useState('')

  // ── cálculo de saldo ─────────────────────────────────────────────────────
  const ingresoNeto = ingreso?.montoNeto ?? 0
  const saldo = calcularSaldoDelMes(ingresoNeto, gastosFijos, gastosDelMes)
  const totalFijosActivos = gastosFijos
    .filter(g => g.activo)
    .reduce((acc, g) => acc + g.monto, 0)
  const totalGastos = gastosDelMes.reduce((acc, g) => acc + g.monto, 0)

  // ── handlers ─────────────────────────────────────────────────────────────
  async function guardarIngreso() {
    const pesos = parseInt(inputIngreso.replace(/\D/g, ''), 10)
    if (isNaN(pesos) || pesos < 0) return
    const montoNeto = pesos * 100
    const existente = await db.ingresos.where('mes').equals(MES_ACTUAL).first()
    if (existente) {
      await db.ingresos.update(existente.id, { montoNeto, actualizadoEn: Date.now() })
    } else {
      await db.ingresos.add({
        id: crypto.randomUUID(),
        mes: MES_ACTUAL,
        montoNeto,
        actualizadoEn: Date.now(),
      })
    }
    setInputIngreso('')
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

  return (
    <main className="min-h-screen bg-[#f5f0e8] flex flex-col max-w-sm mx-auto px-4 py-8 gap-6">

      {/* ── SALDO ─────────────────────────────────────────────────────── */}
      <section className="bg-stone-800 rounded-3xl p-6 text-center shadow-xl">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2">
          Saldo del mes
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

      {/* ── INGRESO Y GASTOS FIJOS ────────────────────────────────────── */}
      <section className="bg-white rounded-3xl p-5 shadow-sm flex flex-col gap-4">
        <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest">
          Ingreso y gastos fijos
        </h2>

        {/* Ingreso neto del mes */}
        <div className="flex flex-col gap-2">
          <label htmlFor="input-ingreso" className="text-xs text-stone-500 font-medium">
            Ingreso neto del mes (en pesos)
          </label>
          <div className="flex gap-2">
            <input
              id="input-ingreso"
              type="number"
              min="0"
              placeholder={ingreso ? String(ingreso.montoNeto / 100) : '0'}
              value={inputIngreso}
              onChange={e => setInputIngreso(e.target.value)}
              className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button
              id="btn-guardar-ingreso"
              type="button"
              onClick={() => { void guardarIngreso() }}
              className="px-4 py-2 rounded-xl bg-stone-800 text-amber-300 text-sm font-semibold hover:bg-stone-700 transition-colors"
            >
              Guardar
            </button>
          </div>
          {ingreso && (
            <p className="text-xs text-stone-400">
              Ingreso actual: {formatARS(ingreso.montoNeto)}
            </p>
          )}
        </div>

        {/* Lista de gastos fijos */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-stone-500 font-medium">Gastos fijos</p>
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
      </section>

      {/* ── ÚLTIMOS GASTOS ────────────────────────────────────────────── */}
      <section className="bg-white rounded-3xl p-5 shadow-sm flex flex-col gap-3">
        <h2 className="text-sm font-bold text-stone-700 uppercase tracking-widest">
          Últimos gastos
        </h2>
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
      </section>
    </main>
  )
}
