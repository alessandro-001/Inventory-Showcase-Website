import { Link } from 'react-router'
import type { Folder } from '../api/types'

// Path from a root folder down to `id` (empty when id is null or unknown).
function trail(tree: Folder[], id: number | null): Folder[] {
  if (!id) return []
  for (const f of tree) {
    if (f.id === id) return [f]
    const sub = trail(f.children, id)
    if (sub.length) return [f, ...sub]
  }
  return []
}

export const folderHref = (id: number | null, q: string) => {
  const qs = new URLSearchParams()
  if (id) qs.set('cat', String(id))
  if (q) qs.set('q', q)
  const s = qs.toString()
  return s ? `/?${s}` : '/'
}

// Breadcrumb + chips for the sub-folders of the current folder. Works one level at a time (phone-friendly).
export function FolderNav({ tree, current, q }: { tree: Folder[]; current: number | null; q: string }) {
  const path = trail(tree, current)
  const children = path.length ? path[path.length - 1].children : tree

  return (
    <nav className="folders" aria-label="Folders">
      <ol className="crumbs">
        <li><Link to={folderHref(null, q)} aria-current={!current ? 'page' : undefined}>All parts</Link></li>
        {path.map((f, i) => (
          <li key={f.id}>
            <Link to={folderHref(f.id, q)} aria-current={i === path.length - 1 ? 'page' : undefined}>{f.name}</Link>
          </li>
        ))}
      </ol>
      {children.length > 0 && (
        <div className="chips">
          {children.map(f => (
            <Link key={f.id} to={folderHref(f.id, q)} className="chip">
              {f.name} <span className="chip-count">{f.total}</span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
