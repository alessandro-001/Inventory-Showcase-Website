import { Link } from 'react-router'
import type { Folder } from '../api/types'
import { useStoredState } from '../hooks/useStoredState'
import { folderHref } from './FolderNav'

// Desktop sidebar: the whole folder tree, sub-folders open by default, current folder highlighted.
// The triangle is its own button (opens/closes, remembered per browser); the name is the link.
export function FolderTree({ tree, current, q, total }: { tree: Folder[]; current: number | null; q: string; total: number }) {
  return (
    <nav className="tree" aria-label="Folders">
      <Link to={folderHref(null, q)} className={`tree-item ${!current ? 'on' : ''}`}>
        <span>All parts</span><span className="chip-count">{total}</span>
      </Link>
      <ul>{tree.map(f => <Node key={f.id} folder={f} current={current} q={q} />)}</ul>
    </nav>
  )
}

function Node({ folder, current, q }: { folder: Folder; current: number | null; q: string }) {
  const [state, setState] = useStoredState(`tree:${folder.id}`, 'open', ['open', 'closed'] as const)
  const open = state === 'open'
  const hasChildren = folder.children.length > 0
  return (
    <li>
      <div className={`tree-row ${folder.id === current ? 'on' : ''}`}>
        {hasChildren
          ? <button type="button" className="tree-toggle" aria-expanded={open}
              aria-label={`${open ? 'Collapse' : 'Expand'} ${folder.name}`} onClick={() => setState(open ? 'closed' : 'open')} />
          : <span className="tree-toggle" aria-hidden="true" />}
        <Link to={folderHref(folder.id, q)} className="tree-item">
          <span>{folder.name}</span><span className="chip-count">{folder.total}</span>
        </Link>
      </div>
      {hasChildren && open && <ul>{folder.children.map(f => <Node key={f.id} folder={f} current={current} q={q} />)}</ul>}
    </li>
  )
}
