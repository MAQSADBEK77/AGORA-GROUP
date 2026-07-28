import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import ReviewQueue from './pages/ReviewQueue'
import ReviewDetail from './pages/ReviewDetail'
import PatientHistory from './pages/PatientHistory'
import PersonalStats from './pages/PersonalStats'
import QADashboard from './pages/QADashboard'
import AdminPanel from './pages/AdminPanel'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"       element={<Dashboard />} />
          <Route path="upload"          element={<Upload />} />
          <Route path="review"          element={<ReviewQueue />} />
          <Route path="review/:id"      element={<ReviewDetail />} />
          <Route path="history"         element={<PatientHistory />} />
          <Route path="stats"           element={<PersonalStats />} />
          <Route path="qa"              element={<QADashboard />} />
          <Route path="admin"           element={<AdminPanel />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
