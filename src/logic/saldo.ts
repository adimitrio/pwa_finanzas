export interface GastoResumen { monto: number }

export function calcularSaldoDelMes(
  ingresoNeto: number,                  // centavos
  gastosDelPeriodo: GastoResumen[]
): number {
  const total = gastosDelPeriodo.reduce((acc, g) => acc + g.monto, 0)
  return ingresoNeto - total
}
