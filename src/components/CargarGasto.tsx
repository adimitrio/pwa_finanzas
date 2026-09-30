import { useState } from 'react'
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

export default function CargarGasto() {
  // pesos acumulados desde el teclado numérico (centavos = pesos * 100)
  const [pesos, setPesos] = useState(0)
  const [categoria, setCategoria] = useState<Categoria>('otros')
  const [medioPago, setMedioPago] = useState<MedioPago>('debito')
  const [guardado, setGuardado] = useState(false)

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
  }

  async function guardar() {
    if (pesos === 0) return
    await db.gastos.add({
      id: crypto.randomUUID(),
      monto: pesos * 100,  // centavos
      categoria,
      medioPago,
      fecha: new Date().toISOString().slice(0, 10),
      actualizadoEn: Date.now(),
    })
    setGuardado(true)
    setTimeout(() => setGuardado(false), 1200)
    resetForm()
  }

  const montoDisplay = pesos.toLocaleString('es-AR')

  return (
    <main className="min-h-screen bg-[#f5f0e8] flex flex-col items-center px-4 py-8 max-w-sm mx-auto">

      {/* Monto */}
      <section className="w-full mb-6">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1 text-center">
          Monto
        </p>
        <div
          id="display-monto"
          className="text-center text-6xl font-bold text-stone-800 tracking-tight leading-none py-4"
          aria-live="polite"
        >
          <span className="text-3xl text-stone-400 mr-1">$</span>
          <span id="display-monto-valor">{montoDisplay}</span>
        </div>
      </section>

      {/* Categoría */}
      <section className="w-full mb-5">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2">
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
                'flex flex-col items-center justify-center rounded-2xl py-2 px-1 text-xs font-semibold transition-all duration-150 select-none',
                categoria === cat
                  ? 'bg-stone-800 text-amber-300 shadow-md scale-105'
                  : 'bg-white text-stone-600 shadow-sm hover:bg-stone-100',
              ].join(' ')}
            >
              <span className="text-xl mb-0.5">{CATEGORIA_LABELS[cat].split(' ')[0]}</span>
              <span className="leading-tight">{CATEGORIA_LABELS[cat].split(' ')[1]}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Medio de pago */}
      <section className="w-full mb-6">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2">
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
                'flex-1 rounded-2xl py-2.5 text-sm font-semibold transition-all duration-150',
                medioPago === medio
                  ? 'bg-stone-800 text-amber-300 shadow-md'
                  : 'bg-white text-stone-600 shadow-sm hover:bg-stone-100',
              ].join(' ')}
            >
              {MEDIO_LABELS[medio]}
            </button>
          ))}
        </div>
      </section>

      {/* Teclado numérico */}
      <section className="w-full mb-5">
        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button
              key={d}
              id={`tecla-${d}`}
              type="button"
              onClick={() => presionarDigito(d)}
              className="bg-white rounded-2xl py-4 text-2xl font-bold text-stone-700 shadow-sm active:scale-95 hover:bg-stone-50 transition-all duration-100"
            >
              {d}
            </button>
          ))}
          {/* Fila inferior: vacío, 0, borrar */}
          <div />
          <button
            id="tecla-0"
            type="button"
            onClick={() => presionarDigito('0')}
            className="bg-white rounded-2xl py-4 text-2xl font-bold text-stone-700 shadow-sm active:scale-95 hover:bg-stone-50 transition-all duration-100"
          >
            0
          </button>
          <button
            id="tecla-borrar"
            type="button"
            onClick={borrar}
            className="bg-white rounded-2xl py-4 text-xl font-bold text-stone-400 shadow-sm active:scale-95 hover:bg-stone-50 transition-all duration-100"
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
          'w-full py-4 rounded-2xl text-lg font-bold tracking-wide transition-all duration-200',
          pesos === 0
            ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
            : guardado
              ? 'bg-green-500 text-white scale-98'
              : 'bg-stone-800 text-amber-300 shadow-lg hover:bg-stone-700 active:scale-95',
        ].join(' ')}
      >
        {guardado ? '✓ Guardado' : 'Guardar gasto'}
      </button>
    </main>
  )
}
