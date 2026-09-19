import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gauge,
  Loader2,
  PhoneOff,
  RefreshCw,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react'
import { api, formatShortDateTime } from '../api/client'
import type { DashboardSummary, LeadQueueItem } from '../lib/types'
import { DncBadge, StatusBadge } from '../components/StatusBadge'
import { sessionRoute } from '../lib/routes'

const STAT_CARDS = [
  { key: 'dropped_off', label: 'Dropped leads', icon: Users, accent: 'text-slate-600 bg-slate-100' },
  { key: 'active_calls', label: 'Active calls', icon: Clock, accent: 'text-amber-700 bg-amber-100' },
  { key: 'completed', label: 'Journeys completed', icon: CheckCircle2, accent: 'text-emerald-700 bg-emerald-100' },
  { key: 'handoffs', label: 'Human handoffs', icon: UserCheck, accent: 'text-red-700 bg-red-100' },
  { key: 'declined', label: 'Declined', icon: PhoneOff, accent: 'text-red-700 bg-red-100' },
  { key: 'dnc_blocked', label: 'DNC blocked', icon: Ban, accent: 'text-slate-600 bg-slate-200' },
] as const

export function DashboardPage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [leads, setLeads] = useState<LeadQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyLead, setBusyLead] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [summaryData, leadData] = await Promise.all([api.dashboardSummary(), api.listLeads()])
      setSummary(summaryData)
      setLeads(leadData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const startRecovery = async (lead: LeadQueueItem) => {
    // A call is already open for this lead: go back to it instead of stacking a second
    // one on top (which would bury the first call's transcript and captured details).
    if (lead.latest_session_status === 'ACTIVE' && lead.latest_session_id) {
      navigate(`/calls/${lead.latest_session_id}`)
      return
    }
    if (
      lead.latest_session_status === 'HANDOFF_REQUESTED' &&
      !window.confirm(
        `${lead.lead.first_name} has a handoff waiting for a human. Start a new AI call anyway?\n\n` +
          'The earlier call stays in the Handoff console and under "Other calls with this lead".',
      )
    ) {
      return
    }
    setBusyLead(lead.lead.id)
    setNotice(null)
    try {
      const result = await api.startCall(lead.lead.id)
      if (result.blocked) {
        setNotice(
          `Dialling refused for ${lead.lead.id}: ${result.blocked_reason}. ` +
            'No call session was created and no prompts were spoken.',
        )
        await load()
        return
      }
      if (result.session) navigate(`/calls/${result.session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start the call')
    } finally {
      setBusyLead(null)
    }
  }

  const openRow = (lead: LeadQueueItem) => {
    if (!lead.latest_session_id) return
    navigate(sessionRoute(lead.latest_session_status ?? 'ACTIVE', lead.latest_session_id))
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Loading recovery queue…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Recovery queue</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Dropped Energy comparison leads, ranked for voice recovery. Do-Not-Call is checked
            before any call is placed.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/upload"
            className="inline-flex items-center gap-1.5 rounded-md bg-navy-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            Upload recording
          </Link>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-navy-900"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          <Ban className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          {notice}
        </div>
      )}

      {/* Counts */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {STAT_CARDS.map(({ key, label, icon: Icon, accent }) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <span className={`flex h-7 w-7 items-center justify-center rounded-md ${accent}`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-900">
              {summary?.counts[key] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* Efficiency strip */}
      {summary && summary.calls_placed > 0 && (
        <div className="mb-5 rounded-xl border border-navy-200 bg-navy-50 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy-700">
            <Gauge className="h-3.5 w-3.5" aria-hidden />
            Automated recovery effort
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {[
              { label: 'Calls placed', value: summary.calls_placed },
              { label: 'Completion rate', value: `${Math.round(summary.completion_rate * 100)}%` },
              { label: 'Handoff rate', value: `${Math.round(summary.handoff_rate * 100)}%` },
              { label: 'Fields auto-captured', value: summary.fields_captured_automatically },
              {
                label: 'Manual typing avoided',
                value: `${summary.estimated_manual_minutes_saved} min`,
              },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-lg font-semibold tabular-nums text-navy-900">{item.value}</p>
                <p className="text-[11px] text-navy-600">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lead table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="whitespace-nowrap px-4 py-2.5">Lead</th>
              <th className="whitespace-nowrap px-4 py-2.5">Contact</th>
              <th className="whitespace-nowrap px-4 py-2.5">Last completed step</th>
              <th className="whitespace-nowrap px-4 py-2.5">DNC</th>
              <th className="whitespace-nowrap px-4 py-2.5">Call status</th>
              <th className="whitespace-nowrap px-4 py-2.5">Last activity</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((item) => {
              const status = item.latest_session_status ?? 'NOT_CALLED'
              const canOpen = Boolean(item.latest_session_id)
              const inFlight = busyLead === item.lead.id
              return (
                <tr key={item.lead.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy-900">
                      {item.lead.first_name} {item.lead.last_name ?? ''}
                    </p>
                    <p className="font-mono text-[11px] text-slate-400">{item.lead.id}</p>
                    {item.expected_outcome && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        demo target: <span className="font-mono">{item.expected_outcome}</span>
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <p>{item.lead.phone}</p>
                    <p className="text-slate-400">{item.lead.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                      {item.lead.last_completed_step}
                    </span>
                    <p className="mt-1 text-[11px] text-slate-400">
                      resumes at <span className="font-mono">{item.resume_step}</span>
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <DncBadge dnc={item.lead.dnc_status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={status} />
                    {item.outcome_detail && (
                      <p className="mt-1 font-mono text-[10px] text-slate-400">
                        {item.outcome_detail}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {item.started_at ? (
                      <>
                        <p>started {formatShortDateTime(item.started_at)}</p>
                        {item.ended_at && (
                          <p className="text-slate-400">ended {formatShortDateTime(item.ended_at)}</p>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">never called</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {canOpen && (
                        <button
                          type="button"
                          onClick={() => openRow(item)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:text-navy-900"
                        >
                          Open
                          <ChevronRight className="h-3 w-3" aria-hidden />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!item.can_start || inFlight}
                        onClick={() => startRecovery(item)}
                        title={
                          item.lead.dnc_status
                            ? 'Blocked by Do-Not-Call — dialling refused'
                            : 'Place the recovery call'
                        }
                        className="inline-flex items-center gap-1 rounded-md bg-navy-800 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        {inFlight ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        ) : (
                          <PhoneOff className="h-3 w-3 rotate-45" aria-hidden />
                        )}
                        {!item.can_start
                          ? 'DNC blocked'
                          : item.latest_session_status === 'ACTIVE'
                            ? 'Resume call'
                            : 'Start recovery'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        All leads are synthetic. Phone numbers use the ACMA test range, email addresses use
        example.com. No real customer data is present in this system.
      </p>
    </div>
  )
}
