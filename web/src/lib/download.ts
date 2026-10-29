// Save a Blob as a file: object URL + a temporary <a download>. The URL is revoked later, not at once:
// Safari/iOS can still be reading it after the click returns.
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
