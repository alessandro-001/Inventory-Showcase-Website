import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { AdminPage } from './pages/AdminPage'
import { InventoryPage } from './pages/InventoryPage'
import { ReviewPage } from './pages/ReviewPage'
import { ScanPage } from './pages/ScanPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<InventoryPage />} />
        <Route path="scan" element={<ScanPage />} />
        <Route path="review/:id" element={<ReviewPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
