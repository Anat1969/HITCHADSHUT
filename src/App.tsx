import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'

const AdminApp = lazy(() => import('./admin/AdminApp'))
const PlanStory = lazy(() => import('./pages/PlanStory'))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/p/:id" element={<Home />} />
        <Route
          path="/plan/:planNumber"
          element={
            <Suspense fallback={<div className="loading">טוען את התוכנית...</div>}>
              <PlanStory />
            </Suspense>
          }
        />
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="loading">טוען...</div>}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}
