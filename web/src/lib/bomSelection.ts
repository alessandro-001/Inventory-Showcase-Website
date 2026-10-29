// Which BOM the admin page should open when none is selected. Skips BOMs deleted in this session, because the
// list shown right after a delete can still be the stale one (it reloads in the background).
export function firstRemaining(boms: { id: number }[], deleted: number[]): number | null {
  return boms.find(b => !deleted.includes(b.id))?.id ?? null
}
