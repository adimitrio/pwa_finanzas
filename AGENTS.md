# Finanzas — Contexto para agentes

## Qué es este proyecto
PWA offline para gestionar finanzas personales (ARS). Sin backend por ahora:
todo se guarda localmente en el dispositivo. Cada feature tiene su spec en
`specs/` — implementar solo lo que dice el spec correspondiente.

## Stack
- Vite + React + TypeScript
- Tailwind CSS para estilos
- Dexie (IndexedDB) para persistencia local
- Vitest para tests

## Reglas de dominio (no negociables)
- Los montos SIEMPRE son enteros en centavos (150000 = $1.500,00). Nunca floats.
- Las fechas se guardan como string: 'YYYY-MM-DD' en gastos, 'YYYY-MM' en
  ingresos. Nunca como objeto Date.
- Todo `id` es un UUID (`crypto.randomUUID()`), nunca autoincremental.
- Todo registro lleva `actualizadoEn: number` (timestamp), pensando en una
  futura sincronización entre dispositivos.
- Los cálculos (saldo del mes, totales, proyecciones) son funciones puras en
  `src/logic/`. Nunca se guarda un resultado calculado en la base.

## Modelo de datos
Ver `src/db/schema.ts`. Tres tablas: `gastos`, `ingresos`, `periodos`. "Fijo" no es
tabla: es la etiqueta `esFijo` de un `Gasto`.
No agregar tablas ni campos nuevos que no estén pedidos en un spec.

## Alcance del MVP — no salirse de acá sin avisar
**Adentro:** carga rápida de gasto, saldo del mes, gastos fijos editables,
ingreso simple (sin historial de aumentos ni aguinaldo todavía), PWA
instalable y offline, exportar/importar JSON como backup.

**Afuera por ahora:** cuotas de tarjeta de crédito, importar PDF de resumen,
proyección a varios meses, escenarios ("qué pasa si..."), sincronización
entre dispositivos, inversiones.

Si una tarea requiere tocar algo de "afuera" para completarse, parar y
avisar antes de implementarlo — no expandir el alcance en silencio.

## Comandos
- `npm run dev` — servidor de desarrollo
- `npm run test` — correr tests con Vitest
- `npm run build` — build de producción

## Cómo trabajar
1. Leer el spec de la feature en `specs/` antes de escribir código.
2. Toda función en `src/logic/` lleva tests. No dar una tarea por terminada
   con `npm run test` en rojo.
3. Preferir tipos explícitos sobre `any`. Componentes chicos y enfocados.
4. Commits chicos: uno por feature o corrección, con mensaje descriptivo.
