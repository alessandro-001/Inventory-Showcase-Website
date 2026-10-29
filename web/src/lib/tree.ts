// Category folders are flat rows with a parent id; these turn them into what the UI needs.
import type { Folder } from '../api/types'

export interface Category { id: number; parent_id: number | null; name: string }

// rows [{id, parent_id, name, n}] -> nested [{..., children, total}] where total includes sub-folders
export function buildTree(cats: (Category & { n: number })[]): Folder[] {
  const m = new Map<number, Folder>(cats.map(c => [c.id, { ...c, total: 0, children: [] }]))
  const roots: Folder[] = []
  for (const n of m.values()) (m.get(n.parent_id ?? 0)?.children ?? roots).push(n)
  const sum = (n: Folder): number => (n.total = n.n + n.children.reduce((s, k) => s + sum(k), 0))
  roots.forEach(sum)
  return roots
}

// id plus every sub-folder id (filtering by a folder includes its children)
export function descendantIds(cats: Category[], id: number): number[] {
  const out = [id]
  for (let i = 0; i < out.length; i++) for (const c of cats) if (c.parent_id === out[i]) out.push(c.id)
  return out
}

// "Capacitors / Ceramic"
export function pathOf(cats: Category[], id: number): string {
  const by = new Map(cats.map(c => [c.id, c]))
  const p: string[] = []
  for (let c = by.get(id); c; c = c.parent_id === null ? undefined : by.get(c.parent_id)) p.unshift(c.name)
  return p.join(' / ')
}
