/** Descarga un archivo en el navegador sin servidor.
 *  Crea un Blob, genera una URL temporal, la clickea y la revoca. */
export function descargarArchivo(nombre: string, contenido: string, mime: string): void {
  const blob = new Blob([contenido], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
