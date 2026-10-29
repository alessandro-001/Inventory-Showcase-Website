import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api } from '../api/client'
import type { BomLine } from '../api/types'
import { useAsync } from '../hooks/useAsync'
import { firstRemaining } from '../lib/bomSelection'
import { Alert } from './Alert'
import { BomFilePicker } from './BomFilePicker'
import { ProjectView } from './ProjectView'

// Admin › Projects: project list + "Import BOM" on the left, the selected project (?project=<id>) on the right.
export function ProjectsPanel({ nav }: { nav: ReactNode }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const selected = Number(params.get('project')) || null
  const list = useAsync(() => api.projects(), [])
  const detail = useAsync(() => (selected ? api.project(selected) : Promise.resolve(null)), [selected])
  const [deleted, setDeleted] = useState<number[]>([])
  const [error, setError] = useState('')

  const projects = (list.data?.projects ?? []).filter(p => !deleted.includes(p.id))
  const first = firstRemaining(list.data?.projects ?? [], deleted)
  useEffect(() => {
    if (!selected && first) navigate(`/admin?project=${first}`, { replace: true })
  }, [selected, first, navigate])

  async function create({ name, fileName, lines }: { name: string; fileName: string; lines: BomLine[] }) {
    const { id } = await api.createProject(name, fileName, lines)
    list.reload()
    navigate(`/admin?project=${id}`)
  }

  async function remove() {
    const p = detail.data?.project
    if (!p || !confirm(`Delete "${p.name}"? Its build history stays.`)) return
    try {
      await api.deleteProject(p.id)
      setDeleted(d => [...d, p.id])
      list.reload()
      navigate('/admin', { replace: true })
    } catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="admin">
      <aside className="admin-side">
        {nav}
        {list.error && <Alert>{list.error}</Alert>}
        <nav className="bom-list" aria-label="Projects">
          <ul>
            {projects.map(p => (
              <li key={p.id}>
                <Link to={`/admin?project=${p.id}`} className={`tree-item ${p.id === selected ? 'on' : ''}`}
                  aria-current={p.id === selected ? 'page' : undefined}>
                  <span>{p.name}</span><span className="chip-count">{p.lines}</span>
                </Link>
              </li>
            ))}
          </ul>
          <BomFilePicker mode="create" label="Import BOM" onConfirm={create} />
          <a href="/sample-bom.csv" download className="sample-bom">Try it with a sample BOM</a>
        </nav>
      </aside>

      <section className="admin-main">
        {list.data && !projects.length && (
          <div className="empty"><p>No projects yet. Import a BOM exported from Altium (.xlsx or .csv) to start one.</p></div>
        )}
        {error && <Alert>{error}</Alert>}
        {detail.error && <Alert>{detail.error}</Alert>}
        {detail.data && (
          <div className={detail.loading ? 'is-loading' : ''}>
            <ProjectView key={detail.data.project.id} detail={detail.data} onChanged={() => { list.reload(); detail.reload() }} onDelete={remove} />
          </div>
        )}
      </section>
    </div>
  )
}
