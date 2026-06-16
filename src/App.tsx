import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import CalendarPage from '@/pages/CalendarPage'
import DashboardPage from '@/pages/DashboardPage'
import TeamPage from '@/pages/TeamPage'
import ProvidersPage from '@/pages/ProvidersPage'
import DocumentsPage from '@/pages/DocumentsPage'
import KonePage from '@/pages/KonePage'
import CominIonPage from '@/pages/CominIonPage'
import FoodPage from '@/pages/FoodPage'
import RepairsPage from '@/pages/RepairsPage'
import ReportsPage from '@/pages/ReportsPage'
import SettingsPage from '@/pages/SettingsPage'
import MyAreaPage from '@/pages/MyAreaPage'
import RondasPage from '@/pages/RondasPage'

function AppRoutes() {
  const { worker, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Cargando...</div>
      </div>
    )
  }

  if (!worker) return <LoginPage />

  return (
    <NotificationsProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/calendar" replace />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/my-area" element={<MyAreaPage />} />
          <Route path="/repairs" element={<RepairsPage />} />
          <Route path="/rondas" element={<RondasPage />} />
          <Route path="/kone" element={<KonePage />} />
          <Route path="/comin-ion" element={<CominIonPage />} />
          <Route path="/food" element={<FoodPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/providers" element={<ProvidersPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/calendar" replace />} />
        </Routes>
      </Layout>
    </NotificationsProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
