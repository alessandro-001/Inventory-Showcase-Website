// Pieces needed to build boards, in integer math (loss in tenths of a percent), so 100 × 10 % is 110, never 111.
export const MAX_BOARDS = 100_000

// 2.5 (%) -> 25; null unless 0–50 with at most one decimal
export function lossTenths(pct: unknown): number | null {
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 50) return null
  const t = Math.round(pct * 10)
  return Math.abs(pct * 10 - t) > 1e-9 ? null : t
}

// ceil(perBoard × boards × (1 + loss/100))
export const needFor = (perBoard: number, boards: number, tenths: number) =>
  Math.floor((perBoard * boards * (1000 + tenths) + 999) / 1000)

// largest board count every part's stock covers
export function maxBoards(parts: { perBoard: number; stock: number }[], tenths: number): number {
  let max = MAX_BOARDS
  for (const { perBoard, stock } of parts) {
    let n = Math.min(MAX_BOARDS, Math.floor(stock * 1000 / (perBoard * (1000 + tenths))))
    while (n > 0 && needFor(perBoard, n, tenths) > stock) n--
    while (n < MAX_BOARDS && needFor(perBoard, n + 1, tenths) <= stock) n++
    max = Math.min(max, n)
  }
  return max
}

// lines matched to the same inventory part are needed together
export function byPart(lines: { partId: number; perBoard: number }[]): { partId: number; perBoard: number }[] {
  const m = new Map<number, number>()
  for (const { partId, perBoard } of lines) m.set(partId, (m.get(partId) ?? 0) + perBoard)
  return [...m].map(([partId, perBoard]) => ({ partId, perBoard }))
}
