import { NavLink, Outlet } from 'react-router'
import { api } from '../api/client'
import { DemoBanner } from './DemoBanner'
import { ThemeToggle } from './ThemeToggle'

export function AppLayout() {
  return (
    <>
      <DemoBanner />
      <header className="topbar">
        <NavLink to="/" end className="brand">
          <img src="/icon.svg" alt="" width="28" height="28" />
          <span className="hide-sm">Electronic Components Inventory — Demo</span>
          <span className="show-sm">Components — Demo</span>
        </NavLink>
        <nav className="topnav">
          <NavLink to="/" end className="hide-sm">Inventory</NavLink>
          <NavLink to="/admin">Admin</NavLink>
          <NavLink to="/scan" className="btn btn-primary btn-sm">Scan</NavLink>
          <button type="button" className="link hide-sm" onClick={() => api.exportJson()}>Export</button>
          <ThemeToggle />
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
