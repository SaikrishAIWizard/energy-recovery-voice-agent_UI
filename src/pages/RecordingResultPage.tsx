import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  MinusCircle,
  PhoneOff,
  ShieldCheck,
  Trophy,
  UploadCloud,
  UserCheck,
} from 'lucide-react'
import {
  api,
  FIELD_LABELS,
  formatClock,
  formatDateTime,
  formatValue,
  fieldRows,
  HANDOFF_REASON_LABELS,
} from '../api/client'
import type { CallSession, JourneyField } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'

type ItemState = 'FOUND' | 'UNCLEAR' | 'MISSING'

function itemState(row: JourneyField): ItemState {
  if (row.status === 'VALID') return 'FOUND'
  if (row.status === 'INVALID') return 'UNCLEAR'
  return 'MISSING'
}

const ITEM_STYLE: Record<ItemState, { chip: string; label: string; icon: typeof CheckCircle2 }> = {
  FOUND: { chip: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25', label: 'Found', icon: CheckCircle2 },
  UNCLEAR: { chip: 'bg-amber-50 text-amber-900 ring-amber-600/30', label: 'Unclear', icon: AlertTriangle },
  MISSING: { chip: 'bg-red-50 text-red-800 ring-red-600/25', label: 'Missing', icon: MinusCircle },
}

function Chip({ state }: { state: ItemState }) {
  const style = ITEM_STYLE[state]
  const Icon = style.icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style.chip}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {style.label}
    </span>
  )
}

function sourceLabel(row: JourneyField): string {
  return row.source === 'PREEXISTING' ? 'On file / earlier upload' : 'Heard in this recording'
}

function Outcome({ session, missing }: { session: CallSession; missing: string[] }) {
  const name = `${session.lead.first_name} ${session.lead.last_name ?? ''}`.trim()

  if (session.status === 'COMPLETED') {
    return (
      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
          <Trophy className="h-4 w-4" aria-hidden />
          Every checklist item was found. The journey was submitted
          {session.submission ? ` as ${session.submission.submission_id}` : ''}.
        </p>
        <Link
          to={`/completed/${session.id}`}
          className="mt-2 inline-block text-sm font-medium text-emerald-900 underline"
        >
          View the completed journey
        </Link>
      </div>
    )
  }

  if (session.status === 'INCOMPLETE') {
    return (
      <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {missing.length} of 6 checklist items {missing.length === 1 ? 'is' : 'are'} not in the
          recording. {name} is in the recovery queue.
        </p>
        <p className="mt-1 text-sm text-amber-900">
          Still needed: {missing.map((field) => FIELD_LABELS[field] ?? field).join(', ')}. A
          recovery call will pick up at the first of these and won&apos;t re-ask what was already
          captured.
        </p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm font-medium text-amber-900">
          <Link to="/" className="underline">
            Go to the recovery queue
          </Link>
          <Link to={`/upload?lead=${session.lead_id}`} className="underline">
            Upload another recording for {session.lead.first_name}
          </Link>
        </div>
      </div>
    )
  }

  if (session.status === 'HANDOFF_REQUESTED') {
    return (
      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
          <UserCheck className="h-4 w-4" aria-hidden />
          Needs a human
          {session.handoff_reason ? `: ${HANDOFF_REASON_LABELS[session.handoff_reason] ?? session.handoff_reason}` : ''}
          . Nothing was submitted.
        </p>
        <Link to={`/handoff/${session.id}`} className="mt-2 inline-block text-sm font-medium text-red-900 underline">
          Open the handoff
        </Link>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
        <PhoneOff className="h-4 w-4" aria-hidden />
        The customer declined further contact. Nothing was submitted and no retry is queued.
      </p>
    </div>
  )
}

export function RecordingResultPage() {
  const { callSessionId = '' } = useParams()
  const [session, setSession] = useState<CallSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .getCall(callSessionId)
      .then((data) => {
        setSession(data)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the recording'))
      .finally(() => setLoading(false))
  }, [callSessionId])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Loading recording analysis…
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-sm text-slate-600">
        {error ?? 'Recording not found.'}
      </div>
    )
  }

  // The queue sends every "Recovery needed" lead here; only uploads belong on this page.
  if (session.mode !== 'RECORDING_UPLOAD') {
    return <Navigate to={`/calls/${session.id}`} replace />
  }

  const rows = fieldRows(session)
  const missing = rows.filter((row) => itemState(row) !== 'FOUND').map((row) => row.field_name)
  const found = rows.length - missing.length
  const lead = session.lead

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
              <UploadCloud className="h-5 w-5 text-navy-600" aria-hidden />
              Recording analysis
            </h1>
            <p className="text-sm text-slate-500">
              {lead.first_name} {lead.last_name ?? ''} · <span className="font-mono">{lead.id}</span> ·{' '}
              {formatDateTime(session.started_at)}
            </p>
          </div>
        </div>
        <StatusBadge status={session.status} />
      </header>

      <Outcome session={session} missing={missing} />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Checklist */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-card lg:col-span-5">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
              Checklist
            </h2>
            <span className="font-mono text-[11px] text-slate-500">{found}/6 found</span>
          </header>
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => {
              const state = itemState(row)
              return (
                <li key={row.field_name} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy-900">{FIELD_LABELS[row.field_name]}</p>
                    <p className="mt-0.5 break-words text-sm text-slate-700">
                      {state === 'MISSING' ? <span className="text-slate-400">Not in the recording</span> : formatValue(row.value)}
                    </p>
                    {row.status !== 'PENDING' && (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {sourceLabel(row)}
                        {row.confidence !== null ? ` · ${Math.round(row.confidence * 100)}% confidence` : ''}
                      </p>
                    )}
                  </div>
                  <Chip state={state} />
                </li>
              )
            })}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
            <p className="text-xs text-slate-600">Recording disclosure</p>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                session.recording_consent_disclosed ? 'text-emerald-800' : 'text-amber-800'
              }`}
            >
              {session.recording_consent_disclosed ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              )}
              {session.recording_consent_disclosed ? 'Heard in the recording' : 'Not found in the transcript'}
            </span>
          </div>
        </section>

        {/* Transcript + audit */}
        <div className="space-y-4 lg:col-span-7">
          <section className="rounded-xl border border-slate-200 bg-white shadow-card">
            <header className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Transcript</h2>
            </header>
            <div className="max-h-[440px] overflow-y-auto p-4">
              <ul className="space-y-2.5">
                {session.transcript.map((segment) => {
                  const customer = segment.speaker === 'CUSTOMER'
                  return (
                    <li key={segment.id} className="flex gap-3 text-sm">
                      <span className="mt-0.5 w-32 shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-wide text-slate-400">
                        <span className={customer ? 'text-navy-700' : ''}>
                          {segment.speaker.replace('_', ' ')}
                        </span>{' '}
                        {formatClock(segment.start_seconds)}
                      </span>
                      <span className={customer ? 'text-navy-900' : 'text-slate-600'}>
                        {segment.text}
                        {segment.redacted && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/25">
                            <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                            redacted
                          </span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-card">
            <details>
              <summary className="cursor-pointer px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-navy-800">
                Audit events ({session.audit_events.length})
              </summary>
              <ul className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
                {session.audit_events.map((event) => (
                  <li key={event.id} className="px-4 py-2">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-navy-700">
                      {event.event_type}
                    </span>
                    <p className="mt-0.5 break-words font-mono text-[10px] leading-relaxed text-slate-500">
                      {event.event_detail}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        </div>
      </div>
    </div>
  )
}
