/** Downloads a JSON value as a file. */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Reads a user-picked file as JSON; throws on invalid JSON. */
export async function readJsonFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text())
}

export function dateStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}
