import type { BomDetail, BomLine, BomSummary, PartDetail, PartForm, PartsResponse, ProjectDetail, ProjectSummary, ScanResult } from './types'
import { createStore } from '../demo/store'
import { downloadBlob } from '../lib/download'

export { ApiError } from '../demo/store'

// Demo: no server. The screens keep talking to `api`; it runs the same rules against the visitor's own copy of the
// sample data in localStorage. Calls stay async (and throw ApiError) exactly like the network version did.
function browserStorage(): Storage | null {
  try { return window.localStorage } catch { return null }
}
const store = createStore(browserStorage())
const call = <T>(f: () => T) => new Promise<T>(resolve => resolve(f()))

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const api = {
  parts: ({ cat, q }: { cat?: number | null; q?: string }) => call<PartsResponse>(() => store.parts({ cat, q })),
  part: (id: number) => call<PartDetail>(() => store.part(id)),

  scan: (barcode: string, force = false) => call<ScanResult>(() => store.scan(barcode, force)),
  restock: (id: number, qty: number) => call(() => store.restock(id, qty)),
  save: (id: number, form: PartForm) => call(() => store.save(id, form)),
  discard: (id: number) => call(() => store.discard(id)),
  remove: (id: number) => call(() => store.remove(id)),

  exportJson: () => call(() => downloadBlob(
    new Blob([JSON.stringify(store.exportJson(), null, 2)], { type: 'application/json' }), 'inventory.json')),
  reset: () => call(() => store.reset()),

  boms: () => call<{ boms: BomSummary[] }>(() => store.boms()),
  bom: (id: number) => call<BomDetail>(() => store.bom(id)),
  createBom: (name: string) => call(() => store.createBom(name)),
  renameBom: (id: number, name: string) => call(() => store.renameBom(id, name)),
  deleteBom: (id: number) => call(() => store.deleteBom(id)),
  addToBom: (bomId: number, partId: number, qty: number) => call(() => store.addToBom(bomId, partId, qty)),
  setBomQty: (bomId: number, partId: number, qty: number) => call(() => store.setBomQty(bomId, partId, qty)),
  removeFromBom: (bomId: number, partId: number) => call(() => store.removeFromBom(bomId, partId)),
  exportBom: (id: number) => call(() => {
    const { fileName, bytes } = store.bomXlsx(id)
    downloadBlob(new Blob([bytes as BlobPart], { type: XLSX_TYPE }), fileName)
  }),

  projects: () => call<{ projects: ProjectSummary[] }>(() => store.projects()),
  project: (id: number) => call<ProjectDetail>(() => store.project(id)),
  createProject: (name: string, fileName: string, lines: BomLine[]) => call(() => store.createProject(name, fileName, lines)),
  renameProject: (id: number, name: string) => call(() => store.renameProject(id, name)),
  deleteProject: (id: number) => call(() => store.deleteProject(id)),
  replaceLines: (id: number, fileName: string, lines: BomLine[]) => call(() => store.replaceLines(id, fileName, lines)),
  build: (id: number, boards: number, lossPct: number, requestId: string) => call(() => store.build(id, boards, lossPct, requestId)),
  undoBuild: (id: number, buildId: number) => call(() => store.undoBuild(id, buildId)),
  shortagesToList: (id: number, boards: number, lossPct: number, bomId: number) =>
    call(() => store.shortagesToList(id, boards, lossPct, bomId)),
}
