import { useState } from 'react'
import './index.css'
import CargarGasto from './components/CargarGasto'
import Inicio from './components/Inicio'
import type { Gasto } from './db/schema'

type Pantalla = 'inicio' | 'cargar' | 'editar'

function App() {
  const [pantalla, setPantalla] = useState<Pantalla>('inicio')
  const [gastoEditando, setGastoEditando] = useState<Gasto | undefined>(undefined)

  function irAEditar(gasto: Gasto) {
    setGastoEditando(gasto)
    setPantalla('editar')
  }

  function volverAInicio() {
    setGastoEditando(undefined)
    setPantalla('inicio')
  }

  if (pantalla === 'cargar') {
    return <CargarGasto onVolver={volverAInicio} />
  }
  if (pantalla === 'editar' && gastoEditando) {
    return <CargarGasto gasto={gastoEditando} onVolver={volverAInicio} />
  }
  return (
    <Inicio
      onCargarGasto={() => setPantalla('cargar')}
      onEditarGasto={irAEditar}
    />
  )
}

export default App
