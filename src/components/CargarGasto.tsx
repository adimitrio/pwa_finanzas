import { useEffect, useRef, useState } from 'react'
import { db } from '../db/schema'
import type { Categoria, MedioPago } from '../db/schema'

const CATEGORIAS: Categoria[] = [
  'super', 'comida', 'transporte', 'salud', 'hogar', 'ocio', 'otros',
]

const CATEGORIA_LABELS: Record<Categoria, string> = {
  super: '🛒 Super',
  comida: '🍽️ Comida',
  transporte: '🚌 Transporte',
  salud: '💊 Salud',
  hogar: '🏠 Hogar',
  ocio: '🎮 Ocio',
  otros: '📦 Otros',
}

const MEDIOS: MedioPago[] = ['efectivo', 'debito', 'credito']

const MEDIO_LABELS: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
}

// Cuánto se muestra "✓ Guardado" antes de volver a Inicio
const MS_CONFIRMACION = 600

const CLASE_TECLA =
  'bg-white border border-borde rounded-sm text-xl font-semibold text-stone-700 shadow-sm active:scale-95 hover:bg-stone-50 transition-all duration-100'

interface Props {
  onVolver: () => void
}

export default function CargarGasto({ onVolver }: Props) {
  // pesos acumulados desde el teclado numérico (centavos = pesos * 100)
  const [pesos, setPesos] = useState(0)
  const [categoria, setCategoria] = useState<Categoria>('otros')
  const [medioPago, setMedioPago] = useState<MedioPago>('debito')
  const [descripcion, setDescripcion] = useState('')
  const [esFijo, setEsFijo] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const timerVolver = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // si se desmonta antes de que venza el timer, no se llama a onVolver
  useEffect(() => () => clearTimeout(timerVolver.current), [])

  function presionarDigito(digito: string) {
    setPesos(prev => {
      const nuevaCadena = String(prev) + digito
      const nuevo = parseInt(nuevaCadena, 10)
      // limitar a 7 dígitos (máx $9.999.999)
      return nuevo > 9_999_999 ? prev : nuevo
    })
  }

  function borrar() {
    setPesos(prev => {
      const s = String(prev)
      if (s.length <= 1) return 0
      return parseInt(s.slice(0, -1), 10)
    })
  }

  function resetForm() {
    setPesos(0)
    setCategoria('otros')
    setMedioPago('debito')
    setDescripcion('')
    setEsFijo(false)
  }

  // ✕: vuelve sin guardar y cancela una navegación pendiente (evita llamar dos veces)
  function volver() {
    clearTimeout(timerVolver.current)
    onVolver()
  }

  async function guardar() {
    if (pesos === 0) return
    const texto = descripcion.trim()
    await db.gastos.add({
      id: crypto.randomUUID(),
      monto: pesos * 100,  // centavos
      categoria,
      medioPago,
      fecha: new Date().toISOString().slice(0, 10),
      esFijo,
      // sin descripción, el campo no se guarda (no un string vacío)
      ...(texto ? { descripcion: texto } : {}),
      actualizadoEn: Date.now(),
    })
    setGuardado(true)
    resetForm()
    // dejar que se pinte "✓ Guardado" antes de navegar
    timerVolver.current = setTimeout(() => {
      setGuardado(false)
      onVolver()
    }, MS_CONFIRMACION)
  }

  const montoDisplay = pesos.toLocaleString('es-AR')

  return (
    <main className="h-dvh bg-fondo flex flex-col justify-between gap-3 px-4 py-3 max-w-sm mx-auto">

      {/* Encabezado: volver sin guardar + monto */}
      <section className="w-full">
        <div className="relative flex items-center justify-center">
          <button
            id="btn-volver"
            type="button"
            onClick={volver}
            aria-label="Volver"
            className="absolute left-0 text-2xl text-stone-400 hover:text-stone-600 transition-colors leading-none"
          >
            ✕
          </button>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
            Monto
          </p>
        </div>
        <div
          id="display-monto"
          className="text-center font-display font-semibold tabular-nums text-5xl text-stone-800 tracking-tight leading-none py-2"
          aria-live="polite"
        >
          <span className="text-2xl text-stone-400 mr-1">$</span>
          <span id="display-monto-valor">{montoDisplay}</span>
        </div>
      </section>

      {/* Categoría */}
      <section className="w-full">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
          Categoría
        </p>
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Categoría">
          {CATEGORIAS.map(cat => (
            <button
              key={cat}
              id={`cat-${cat}`}
              type="button"
              onClick={() => setCategoria(cat)}
              aria-pressed={categoria === cat}
              className={[
                'flex flex-col items-center justify-center rounded-sm py-1.5 px-1 text-xs font-semibold transition-all duration-150 select-none',
                categoria === cat
                  ? 'bg-tarjeta-oscura text-acento shadow-md scale-105'
                  : 'bg-white text-stone-600 shadow-sm hover:bg-stone-100',
              ].join(' ')}
            >
              <span className="text-lg leading-tight">{CATEGORIA_LABELS[cat].split(' ')[0]}</span>
              <span className="leading-tight">{CATEGORIA_LABELS[cat].split(' ')[1]}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Medio de pago */}
      <section className="w-full">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
          Medio de pago
        </p>
        <div className="flex gap-2" role="group" aria-label="Medio de pago">
          {MEDIOS.map(medio => (
            <button
              key={medio}
              id={`medio-${medio}`}
              type="button"
              onClick={() => setMedioPago(medio)}
              aria-pressed={medioPago === medio}
              className={[
                'flex-1 rounded-sm py-2 text-sm font-semibold transition-all duration-150',
                medioPago === medio
                  ? 'bg-tarjeta-oscura text-acento shadow-md'
                  : 'bg-white text-stone-600 shadow-sm hover:bg-stone-100',
              ].join(' ')}
            >
              {MEDIO_LABELS[medio]}
            </button>
          ))}
        </div>
      </section>

      {/* Descripción (opcional) y etiqueta "fijo" */}
      <section className="w-full">
        <div className="flex items-center gap-3">
          <input
            id="input-descripcion"
            type="text"
            placeholder="Descripción (opcional)"
            aria-label="Descripción"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            className="flex-1 min-w-0 rounded-sm border border-borde bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-acento"
          />
          <label
            htmlFor="check-es-fijo"
            className="flex items-center gap-1.5 text-sm font-semibold text-stone-600 select-none"
          >
            <input
              id="check-es-fijo"
              type="checkbox"
              checked={esFijo}
              onChange={e => setEsFijo(e.target.checked)}
              className="w-5 h-5 accent-tarjeta-oscura"
            />
            Es fijo
          </label>
        </div>
        <p className="mt-1 text-[11px] leading-tight text-stone-400">
          Para identificarlo como gasto habitual (luz, alquiler, suscripciones). Lo cargás igual
          cada vez, con el monto real.
        </p>
      </section>

      {/* Teclado numérico: absorbe el alto sobrante (o lo cede en pantallas chicas) */}
      <section className="w-full flex-1 min-h-36">
        <div className="grid grid-cols-3 grid-rows-4 gap-2 h-full">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button
              key={d}
              id={`tecla-${d}`}
              type="button"
              onClick={() => presionarDigito(d)}
              className={CLASE_TECLA}
            >
              {d}
            </button>
          ))}
          {/* Fila inferior: 00, 0, borrar */}
          <button
            id="tecla-00"
            type="button"
            onClick={() => presionarDigito('00')}
            className={CLASE_TECLA}
          >
            00
          </button>
          <button
            id="tecla-0"
            type="button"
            onClick={() => presionarDigito('0')}
            className={CLASE_TECLA}
          >
            0
          </button>
          <button
            id="tecla-borrar"
            type="button"
            onClick={borrar}
            className={`${CLASE_TECLA} text-stone-400`}
            aria-label="Borrar último dígito"
          >
            ⌫
          </button>
        </div>
      </section>

      {/* Guardar */}
      <button
        id="btn-guardar"
        type="button"
        onClick={() => { void guardar() }}
        disabled={pesos === 0}
        className={[
          'w-full py-3 rounded-md text-lg font-bold tracking-wide transition-all duration-200',
          // guardado va primero: el monto ya se reseteó a 0 y el verde tiene que verse
          guardado
            ? 'bg-green-500 text-white'
            : pesos === 0
              ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
              : 'bg-tarjeta-oscura text-acento shadow-lg hover:brightness-125 active:scale-95',
        ].join(' ')}
      >
        {guardado ? '✓ Guardado' : 'Guardar gasto'}
      </button>
    </main>
  )
}
