import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { History } from 'lucide-react'
import { api, formatShortDateTime } from '../api/client'
import type { SessionSummary } from '../lib/types'
import { sessionRoute } from '../lib/routes'
import { StatusBadge } from './StatusBadge'

/**
 * The lead's other calls. The queue only shows the latest one, so without this an earlier
 * call (a handoff, a phone conversation) would vanish the moment a new call starts.
 */
export function CallHistoryPanel({
  leadId,
  currentSessionId,
}: {
  leadId: string
  currentSessionId: string
}) {
  const [calls, setCalls] = useState<SessionSummary[]>([])

  useEffect(() => {
    let cancelled = false
    api
      .leadSessions(leadId)
      .then((rows) => {
        if (!cancelled) setCalls(rows.filter((row) => row.id !== currentSessionId))
      })
      .catch(() => {
        /* history is a convenience; the console works without it */
      })
    return () => {
      cancelled = true
    }
  }, [leadId, currentSessionId])

  if (calls.length === 0) return null

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-card">
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <History className="h-3.5 w-3.5" aria-hidden />
          Other calls with this lead
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">{calls.length}</span>
      </header>
      <ul className="divide-y divide-slate-100">
        {calls.map((call) => (
          <li key={call.id}>
            <Link
              to={sessionRoute(call.status, call.id)}
              className="block px-4 py-2.5 transition hover:bg-slate-50"
            >
              <div className="flex items-center justify-between gap-2">
                <StatusBadge status={call.status} size="sm" />
                <span className="text-[11px] text-slate-500">{formatShortDateTime(call.started_at)}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {call.dial_provider === 'twilio' ? 'Phone call' : 'Console call'} ·{' '}
                {call.transcript_segments} lines · {call.fields_captured} of 6 fields captured
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
