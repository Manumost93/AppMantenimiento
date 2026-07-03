import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { ConfirmProvider } from '@/contexts/ConfirmContext'
import Layout from '@/components/Layout'
import UpdatePrompt from '@/components/UpdatePrompt'
import LoginPage from '@/pages/LoginPage'

// Carga diferida — reduce el bundle inicial ~40%
const CalendarPage  = lazy(() => import('@/pages/CalendarPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const MyAreaPage    = lazy(() => import('@/pages/MyAreaPage'))
const RepairsPage   = lazy(() => import('@/pages/RepairsPage'))
const RondasPage    = lazy(() => import('@/pages/RondasPage'))
const SecurityPage  = lazy(() => import('@/pages/SecurityPage'))
const MeetingsPage  = lazy(() => import('@/pages/MeetingsPage'))
const WastePage     = lazy(() => import('@/pages/WastePage'))
const KonePage      = lazy(() => import('@/pages/KonePage'))
const CominIonPage  = lazy(() => import('@/pages/CominIonPage'))
const FoodPage      = lazy(() => import('@/pages/FoodPage'))
const TeamPage      = lazy(() => import('@/pages/TeamPage'))
const ProvidersPage = lazy(() => import('@/pages/ProvidersPage'))
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage'))
const ReportsPage   = lazy(() => import('@/pages/ReportsPage'))
const SettingsPage  = lazy(() => import('@/pages/SettingsPage'))
const CBREPage      = lazy(() => import('@/pages/CBREPage'))
const BmsPage       = lazy(() => import('@/pages/BmsPage'))
const SocLitePage   = lazy(() => import('@/pages/SocLitePage'))
const AuditLogPage  = lazy(() => import('@/pages/AuditLogPage'))
const EdgeAssetsPage = lazy(() => import('@/pages/EdgeAssetsPage'))
const EdgeOpsDashboardPage = lazy(() => import('@/pages/EdgeOpsDashboardPage'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="space-y-3 w-full max-w-md">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-gray-200 dark:bg-slate-700 rounded-xl h-16" />
        ))}
      </div>
    </div>
  )
}

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
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/"           element={<Navigate to="/calendar" replace />} />
            <Route path="/calendar"   element={<CalendarPage />} />
            <Route path="/dashboard"  element={<DashboardPage />} />
            <Route path="/my-area"    element={<MyAreaPage />} />
            <Route path="/repairs"    element={<RepairsPage />} />
            <Route path="/rondas"     element={<RondasPage />} />
            <Route path="/security"   element={<SecurityPage />} />
            <Route path="/meetings"   element={<MeetingsPage />} />
            <Route path="/waste"      element={<WastePage />} />
            <Route path="/kone"       element={<KonePage />} />
            <Route path="/comin-ion"  element={<CominIonPage />} />
            <Route path="/food"       element={<FoodPage />} />
            <Route path="/team"       element={<TeamPage />} />
            <Route path="/providers"  element={<ProvidersPage />} />
            <Route path="/documents"  element={<DocumentsPage />} />
            <Route path="/reports"    element={<ReportsPage />} />
            <Route path="/cbre"       element={<CBREPage />} />
            <Route path="/bms"        element={<BmsPage />} />
            <Route path="/soc-lite"   element={<SocLitePage />} />
            <Route path="/audit-log"  element={<AuditLogPage />} />
            <Route path="/edge-assets" element={<EdgeAssetsPage />} />
            <Route path="/edge-ops" element={<EdgeOpsDashboardPage />} />
            <Route path="/settings"   element={<SettingsPage />} />
            <Route path="*"           element={<Navigate to="/calendar" replace />} />
          </Routes>
        </Suspense>
      </Layout>
      <UpdatePrompt />
    </NotificationsProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
