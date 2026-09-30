export interface GastoFijoResumen { monto: number; activo: boolean }
export interface GastoResumen { monto: number }

export function calcularSaldoDelMes(
  ingresoNeto: number,                  // centavos
  gastosFijos: GastoFijoResumen[],
  gastosDelMes: GastoResumen[]
): number {
  const totalFijos = gastosFijos
    .filter(g => g.activo)
    .reduce((acc, g) => acc + g.monto, 0)
  const totalGastos = gastosDelMes.reduce((acc, g) => acc + g.monto, 0)
  return ingresoNeto - totalFijos - totalGastos
}
