# Spec: Restaurar el look de la app y terminar el botón Eliminar

## Contexto
Un spec anterior (`alinear-diseno-original`) cambió el look a azul y
esquinas de 6/10px por error. `index.css` ya se restauró al dorado y sin
radius, pero `Inicio.tsx`, `CargarGasto.tsx` y `CargarGasto.test.tsx`
pueden haber quedado con clases de ese cambio. Estas clases apuntan a
tokens que ya no existen, así que la app queda sin estilos.

Este spec deja todo como estaba antes de ese error, con la
funcionalidad nueva (editar/eliminar gastos, exportar CSV) intacta.
**No cambia lógica, ids, `aria-label` ni textos visibles.**

## Fuente de verdad del look
La carpeta `specs/diseno/`: `Main.dc.html` (Inicio),
`InicioAbierto.dc.html` (Inicio con tarjetas abiertas),
`CargarGasto.dc.html` y `CargarGastoEditar.dc.html`. Son HTML con los
estilos escritos en línea: leer de ahí colores, tamaños y paddings. No
hace falta abrirlos en un navegador. Si algo no figura ahí, vale lo que
hay en el último commit (`git show HEAD:src/...`).

## Parte A: dejar el look como `specs/diseno/`

### `src/index.css`
Debe quedar igual que en el último commit: colores `fondo #F3EFE6`,
`tarjeta-oscura #1D1C1A`, `acento #C9A24D` (dorado), `borde #E5DFD3`;
`--radius-sm: 0px` y `--radius-md: 0px`; fuentes Plex Sans y Fraunces.
Única adición permitida: el token de la Parte B.

### Componentes
Buscar y eliminar en `src/` (sin contar tests) cualquier uso de:
`superficie`, `tinta`, `tinta-suave`, `tinta-tenue`, `pista`,
`sobre-oscuro`, `sobre-oscuro-suave`, `acento-oscuro`, `exito`,
`peligro-sobre-oscuro`, `border-tinta`. El `grep` de esos nombres debe
dar 0 resultados.

Equivalencias para volver al look de siempre:

| Elemento | Clases |
|---|---|
| Botón "+ Cargar gasto" | `bg-acento text-stone-900 font-bold shadow-lg` |
| "Guardar gasto" / "Guardar cambios" | `bg-tarjeta-oscura text-acento font-bold shadow-lg` |
| Guardado ("✓ Guardado") | `bg-green-500 text-white` |
| Deshabilitado | `bg-stone-200 text-stone-400 cursor-not-allowed` |
| Chip elegido (categoría y medio de pago) | `bg-tarjeta-oscura text-acento shadow-md` (categoría con `scale-105`) |
| Chip sin elegir | `bg-white text-stone-600 shadow-sm hover:bg-stone-100` |
| Medio de pago | tres botones separados con `gap-2`, NO control segmentado |
| Tecla del teclado | `bg-white border border-borde text-xl font-semibold text-stone-700 shadow-sm` |
| Tecla borrar | igual, con texto `text-stone-400` |
| Tarjetas claras (Ingresos, Gastos) | `bg-white border border-borde shadow-sm p-5` |
| Tarjetas oscuras (Saldo, Cerrar período) | `bg-tarjeta-oscura shadow-xl` |
| Cifra del Saldo | `text-acento` si es positivo, `text-red-400` si es negativo |
| Texto secundario | `text-stone-400` / `text-stone-500` |
| Inputs claros | `border border-borde bg-white px-3 py-2 text-sm text-stone-700` |
| Inputs de Cerrar período | `border-stone-600 bg-stone-700 text-stone-100` |
| Botón "Cerrar período" | `bg-stone-100 text-stone-800 font-bold` |
| Error del cierre (`#error-cierre`) | `text-red-400` |

"Cerrar período" vuelve a ser tarjeta oscura (no clara). Los efectos
`active:scale-*` y `hover:brightness-*` que tenían los botones se
mantienen como estaban.

### Lo que se conserva (funcionalidad nueva)
- Las filas de gasto son botones que abren la edición.
- Fecha editable y botón "Eliminar gasto" en modo edición.
- Lista de gastos completa del período, ordenada por fecha.
- Panel de "Exportar gastos".
Estas piezas se estilizan con el look de arriba (dorado, sin radius).

### `src/components/CargarGasto.test.tsx`
Debe quedar compatible con el código restaurado: sin referencias a las
clases del cambio revertido. No eliminar tests de comportamiento.

## Parte B: botón "Eliminar gasto"
Es el único elemento nuevo respecto del look anterior.

1. En `src/index.css`, dentro de `@theme`, agregar un solo token:
   ```css
   --color-peligro: #A8432F;   /* terracota: SOLO el botón Eliminar */
   ```
2. En `CargarGasto.tsx` (modo edición) el botón queda así: ancho
   completo, alto mínimo 44px, `border border-peligro`, texto
   `text-peligro text-sm font-semibold`, fondo transparente,
   `rounded-md` (el token ya lo deja a 0px), separado del botón
   principal con `mt-1` extra. Presionado:
   `active:bg-peligro active:text-white` (nunca `hover:`, queda pegado
   en el celular). Se mantienen `id="btn-eliminar"`, el texto y el
   `window.confirm('¿Eliminar este gasto?')`.
3. `peligro` se usa solo en ese botón. El resto de la app sigue con
   `red-400` para los rojos.

## Parte C: guardar en edición con monto 0
En modo edición, "Guardar cambios" queda deshabilitado también si
`pesos === 0`. Si ya está así, no tocar. Verificar que existe un test
que lo cubre (modo edición, monto llevado a 0, botón deshabilitado); si
no existe, agregarlo.

## Parte D: dejar el diseño registrado
Agregar a `AGENTS.md` una línea: "El diseño de las pantallas es el de
`specs/diseno/` (Inicio, Cargar gasto, Editar gasto). No cambiar
colores, esquinas ni tipografía sin un spec que lo pida."

## Criterio de aceptación
- `npm run test` en verde, `npm run build` sin errores.
- `grep` de los nombres de la Parte A en `src/` (sin tests): 0
  resultados.
- A ojo, Inicio, Cargar gasto y Editar gasto se ven como las pantallas
  de `specs/diseno/`: dorado, sin radius, tarjeta de saldo y de cierre
  oscuras, "Eliminar gasto" con contorno terracota.
- La pantalla de Cargar gasto no hace scroll vertical en un teléfono
  chico.

## Fuera de alcance
Lógica, base de datos, exportación CSV, textos, y cualquier cambio de
color, esquinas o tipografía fuera de lo que lista este spec.
