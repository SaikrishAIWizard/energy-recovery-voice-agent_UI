import { NavLink, Outlet } from 'react-router-dom'
import {
  Activity,
  LayoutDashboard,
  PhoneCall,
  RefreshCw,
  Upload,
  UserCheck,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { HealthResponse } from '../lib/types'

function NavItem({
  to,
  icon: Icon,
  label,
  end = false,
}: {
  to: string
  icon: typeof LayoutDashboard
  label: string
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition ${
          isActive
            ? 'bg-white/10 text-white'
            : 'text-navy-200 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </NavLink>
  )
}

export function AppShell() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [offline, setOffline] = useState(false)
  const [resetting, setResetting] = useState(false)

  const loadHealth = () => {
    api
      .health()
      .then((data) => {
        setHealth(data)
        setOffline(false)
      })
      .catch(() => setOffline(true))
  }

  useEffect(() => {
    loadHealth()
    const timer = window.setInterval(loadHealth, 10000)
    return () => window.clearInterval(timer)
  }, [])

  const resetDemo = async () => {
    setResetting(true)
    try {
      await api.resetDemo()
      window.location.href = '/'
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between bg-navy-900 lg:flex">
        <div>
          <div className="flex items-center gap-2.5 px-4 py-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-navy-950">
              <Zap className="h-5 w-5" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">Energy Recovery</p>
              <p className="text-[11px] text-navy-300">Voice Agent Console</p>
            </div>
          </div>

          <nav className="space-y-1 px-2">
            <NavItem to="/" icon={LayoutDashboard} label="Recovery queue" end />
            <NavItem to="/upload" icon={Upload} label="Upload recording" />
            <NavItem to="/handoffs" icon={UserCheck} label="Handoff console" />
            <NavItem to="/completed" icon={PhoneCall} label="Completed journeys" />
          </nav>

          <div className="mx-2 mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-navy-300">
              <Activity className="h-3 w-3" aria-hidden />
              Runtime
            </p>
            <dl className="space-y-1 text-[11px] text-navy-200">
              <div className="flex justify-between gap-2">
                <dt>Backend</dt>
                <dd className={offline ? 'font-semibold text-red-300' : 'font-semibold text-emerald-300'}>
                  {offline ? 'offline' : 'online'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>LLM</dt>
                <dd className="font-mono text-navy-100">
                  {health?.llm.active_adapter ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>STT</dt>
                <dd className="font-mono text-navy-100">
                  {health?.voice_providers.active.stt ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>TTS</dt>
                <dd className="font-mono text-navy-100">
                  {health?.voice_providers.active.tts ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>API keys</dt>
                <dd className="font-semibold text-emerald-300">not required</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="p-2">
          <button
            type="button"
            onClick={resetDemo}
            disabled={resetting}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-navy-300 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin' : ''}`} aria-hidden />
            Reset demo data
          </button>
          <p className="px-3 pb-3 pt-1 text-[10px] leading-relaxed text-navy-400">
            Synthetic leads only. No real customer data, no live dialling.
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {offline && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
            Backend unreachable. Start it with{' '}
            <code className="rounded bg-red-100 px-1 font-mono">
              uvicorn app.main:app --port 8000
            </code>{' '}
            in <code className="font-mono">backend/</code>.
          </div>
        )}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
