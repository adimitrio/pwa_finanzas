import { useState } from 'react'
import './index.css'
import CargarGasto from './components/CargarGasto'
import Inicio from './components/Inicio'

function App() {
  const [pantalla, setPantalla] = useState<'inicio' | 'cargar'>('inicio')

  return pantalla === 'inicio'
    ? <Inicio onCargarGasto={() => setPantalla('cargar')} />
    : <CargarGasto onVolver={() => setPantalla('inicio')} />
}

export default App
