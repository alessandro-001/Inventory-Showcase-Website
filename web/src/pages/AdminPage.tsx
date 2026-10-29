import { Link, useSearchParams } from 'react-router'
import { ProjectsPanel } from '../components/ProjectsPanel'
import { ReorderLists } from '../components/ReorderLists'

// Admin sections, stacked vertically at the top of the left column so new ones just add a row.
// The section follows the URL: ?bom=<id> or ?tab=lists -> Reorder lists; anything else (incl. ?project=<id>) -> Projects.
export function AdminPage() {
  const [params] = useSearchParams()
  const lists = params.has('bom') || params.get('tab') === 'lists'
  const tab = (to: string, on: boolean, label: string) =>
    <Link to={to} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>{label}</Link>

  const nav = (
    <nav className="admin-tabs" aria-label="Admin sections">
      {tab('/admin', !lists, 'Projects')}
      {tab('/admin?tab=lists', lists, 'Reorder lists')}
    </nav>
  )

  return (
    <>
      <h1 className="sr-only">Admin</h1>
      {lists ? <ReorderLists nav={nav} /> : <ProjectsPanel nav={nav} />}
    </>
  )
}
