// Shapes returned by `api` (web/src/api/client.ts), backed by the in-browser store in web/src/demo/store.ts.

export interface Folder {
  id: number
  parent_id: number | null
  name: string
  n: number // parts directly in this folder
  total: number // including sub-folders
  children: Folder[]
}

export interface PartSummary {
  id: number
  mpn: string
  manufacturer: string
  description: string
  qty: number
  location: string
  image_url: string
  attrs: Record<string, string>
  category_id: number | null
  folder: string
}

export interface Draft {
  id: number
  mpn: string
  manufacturer: string
}

export interface PartsResponse {
  tree: Folder[]
  total: number // all saved parts, ignoring filters
  parts: PartSummary[]
  drafts: Draft[]
}

export interface Part extends Omit<PartSummary, 'folder'> {
  status: 'draft' | 'saved'
  source: string
  label: '' | 'DigiKey' | 'Mouser' | 'LCSC' // which distributor label was scanned ('' = typed or unknown)
  dist_pn: string
  datasheet_url: string
  fuzzy: boolean
}

export interface PartDetail {
  part: Part
  folder: string
  paths: string[]
  boms: { id: number; name: string; qty: number }[] // BOMs this part is on
  locations: string[] // locations already used by saved parts (suggestions)
}

// ---------- BOMs (reorder lists) ----------
// POST /scan: a new draft, or (reorder arrived) the part already in stock + the label's quantity
export interface StockMatch {
  id: number
  mpn: string
  manufacturer: string
  qty: number
  location: string
}
export type ScanResult = { id: number } | { match: StockMatch; qty: number | null } // qty null = not on the label

export interface BomSummary {
  id: number
  name: string
  items: number
}

export interface BomItem {
  part_id: number
  qty: number // quantity to order
  mpn: string
  manufacturer: string
  description: string
  stock: number // quantity in the inventory now
  location: string
  datasheet_url: string
  digikey: string
  lcsc: string
  mouser: string
}

export interface BomDetail {
  bom: { id: number; name: string }
  items: BomItem[]
}

// ---------- Projects ----------
export type { BomLine } from '../lib/bomImport'

export interface ProjectSummary {
  id: number
  name: string
  lines: number
}

export interface ProjectLine {
  mpn: string
  manufacturer: string
  supplier_pn: string
  description: string
  designators: string
  qty_per_board: number
  part: { id: number; qty: number; location: string } | null // matched saved part (live); null = not in the inventory
}

export interface Build {
  id: number
  boards: number
  loss_pct: number
  created_at: string
  pieces: number
}

export interface ProjectDetail {
  project: { id: number; name: string; file_name: string; loss_pct: number | null }
  lines: ProjectLine[]
  builds: Build[] // newest first
}

export interface PartForm {
  mpn: string
  manufacturer: string
  description: string
  folder: string
  qty: string
  location: string
}
