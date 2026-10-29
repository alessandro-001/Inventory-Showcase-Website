// Quantity edits save on blur; clicking "Export to Excel" blurs the field and starts the download at the same time.
// Saves register here so the export can wait for them and never download an old quantity.
const pending = new Set<Promise<unknown>>()

export function trackSave<T>(p: Promise<T>): Promise<T> {
  const settled = p.then(() => {}, () => {})
  pending.add(settled)
  settled.finally(() => pending.delete(settled))
  return p
}

export async function whenSaved(): Promise<void> {
  while (pending.size) await Promise.all([...pending])
}
