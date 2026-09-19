import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  ClipboardCheck,
  FileJson,
  Loader2,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import { api, FIELD_LABELS, formatDateTime, formatValue } from '../api/client'
import type { CallSession, Submission } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'
import { JourneyStepper } from '../components/JourneyStepper'

function PayloadTable({ payload }: { payload: Record<string, string> }) {
  return (
    <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
      {Object.entries(payload).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-4 px-3 py-2">
          <dt className="font-mono text-[11px] text-slate-500">{key}</dt>
          <dd className="text-right text-sm font-medium text-navy-900">
            {key === 'vertical' ? value : formatValue(value)}
            {FIELD_LABELS[key] && (
              <span className="ml-2 text-[10px] font-normal text-slate-400">
                {FIELD_LABELS[key]}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function CompletedJourneyPage() {
  const { callSessionId = '' } = useParams()
  const [session, setSession] = useState<CallSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setSession(await api.getCall(callSessionId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the journey')
    } finally {
      setLoading(false)
    }
  }, [callSessionId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Loading completed journey…
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-sm text-slate-600">
        {error ?? 'Call session not found.'}
      </div>
    )
  }

  if (!session.submission) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-sm text-slate-600">
          No journey was submitted for this call (status: {session.status}).
        </p>
        <Link
          to={`/calls/${session.id}`}
          className="mt-4 inline-block font-medium text-navy-700 underline"
        >
          Open the recovery console
        </Link>
      </div>
    )
  }

  const submission = session.submission

  return (
    <div className="mx-auto max-w-[1300px] px-5 py-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:text-navy-900"
            title="Back to queue"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-navy-900">
              <Trophy className="h-5 w-5 text-emerald-600" aria-hidden />
              Journey completed
            </h1>
            <p className="text-sm text-slate-500">
              {session.mode === 'RECORDING_UPLOAD'
                ? 'Every checklist item was found in the uploaded recording and a valid Energy payload was submitted.'
                : 'The AI agent collected every required field and submitted a valid Energy payload.'}
            </p>
          </div>
        </div>
        <StatusBadge status={session.status} />
      </header>

      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ['Submission ID', submission.submission_id],
            ['Status', submission.status],
            ['Lead', submission.lead_id],
            ['Submitted at', formatDateTime(submission.created_at)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800">
                {label}
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-950">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <section className="rounded-xl border border-slate-200 bg-white shadow-card">
            <header className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2.5">
              <FileJson className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Submitted mock payload
              </h2>
            </header>
            <div className="p-4">
              <PayloadTable payload={submission.payload} />
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-navy-800">
                  Raw JSON (exactly what POST /journey/submit accepted)
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-navy-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-200">
                  {JSON.stringify(submission.payload, null, 2)}
                </pre>
              </details>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-card">
            <header className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2.5">
              <ClipboardCheck className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Full transcript
              </h2>
            </header>
            <div className="max-h-[360px] overflow-y-auto p-4">
              <ul className="space-y-2.5">
                {session.transcript.map((segment) => (
                  <li key={segment.id} className="flex gap-3 text-sm">
                    <span
                      className={`mt-0.5 w-20 shrink-0 font-mono text-[10px] uppercase tracking-wide ${
                        segment.speaker === 'CUSTOMER' ? 'text-navy-700' : 'text-slate-400'
                      }`}
                    >
                      {segment.speaker.replace('_', ' ')}
                    </span>
                    <span
                      className={
                        segment.speaker === 'CUSTOMER'
                          ? 'text-navy-900'
                          : 'text-slate-600'
                      }
                    >
                      {segment.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <div className="space-y-4 lg:col-span-5">
          <section className="rounded-xl border border-slate-200 bg-white shadow-card">
            <header className="border-b border-slate-100 px-4 py-2.5">
              <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                Journey progress
              </h2>
            </header>
            <div className="px-4 py-3">
              <JourneyStepper steps={session.journey_progress} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-card">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Audit events
              </h2>
              <span className="font-mono text-[10px] text-slate-400">
                {session.audit_events.length}
              </span>
            </header>
            <ul className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
              {session.audit_events.map((event) => (
                <li key={event.id} className="px-4 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-navy-700">
                      {event.event_type}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                      {formatDateTime(event.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 break-words font-mono text-[10px] leading-relaxed text-slate-500">
                    {event.event_detail}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * List of completed journeys
 * ------------------------------------------------------------------ */

export function CompletedListPage() {
  const [rows, setRows] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .listSubmissions()
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-navy-900">Completed journeys</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Every payload the mock Energy endpoint accepted, with its receipt.
        </p>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          Loading submissions…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-400">
          <Trophy className="mb-2 h-8 w-8" aria-hidden />
          <p className="text-sm">No journeys submitted yet.</p>
          <p className="mt-1 text-xs">
            Run the scripted call for lead E-1001 to complete one end to end.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Receipt</th>
                <th className="px-4 py-2.5">Lead</th>
                <th className="px-4 py-2.5">Address</th>
                <th className="px-4 py-2.5">Move-in</th>
                <th className="px-4 py-2.5">Supply</th>
                <th className="px-4 py-2.5">Submitted</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.submission_id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-emerald-700">
                    {row.submission_id}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{row.lead_id}</td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-slate-700">
                    {row.payload.property_address}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-700">{row.payload.move_in_date}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-700">
                    {formatValue(row.payload.energy_requirement)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {formatDateTime(row.created_at)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.call_session_id ? (
                      <Link
                        to={`/completed/${row.call_session_id}`}
                        className="text-xs font-medium text-navy-700 underline"
                      >
                        detail
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
