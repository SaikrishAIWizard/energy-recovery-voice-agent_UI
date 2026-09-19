import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { RecoveryConsolePage } from './pages/RecoveryConsolePage'
import { HandoffListPage, HandoffPage } from './pages/HandoffPage'
import { CompletedJourneyPage, CompletedListPage } from './pages/CompletedJourneyPage'
import { DatabasePage } from './pages/DatabasePage'
import { UploadRecordingPage } from './pages/UploadRecordingPage'
import { RecordingResultPage } from './pages/RecordingResultPage'

function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="text-lg font-semibold text-navy-900">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">
        That console route doesn&apos;t exist.
      </p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-navy-700 underline">
        Back to the recovery queue
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/calls/:callSessionId" element={<RecoveryConsolePage />} />
          <Route path="/handoffs" element={<HandoffListPage />} />
          <Route path="/handoff/:callSessionId" element={<HandoffPage />} />
          <Route path="/completed" element={<CompletedListPage />} />
          <Route path="/completed/:callSessionId" element={<CompletedJourneyPage />} />
          <Route path="/upload" element={<UploadRecordingPage />} />
          <Route path="/recordings/:callSessionId" element={<RecordingResultPage />} />
          <Route path="/database" element={<DatabasePage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
