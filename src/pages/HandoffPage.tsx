import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Inbox, Loader2, PhoneForwarded, UserCheck } from 'lucide-react'
import { api, formatDateTime } from '../api/client'
import type { CallSession } from '../lib/types'
import { HandoffCard } from '../components/HandoffCard'
import { TranscriptViewer } from '../components/TranscriptViewer'
import { StatusBadge } from '../components/StatusBadge'
import { handoffAgentStatus, isPhoneHandoff } from '../lib/phone'
import { CallHistoryPanel } from '../components/CallHistoryPanel'
import { HandoffCompletePanel } from '../components/HandoffCompletePanel'

/* ------------------------------------------------------------------ *
 * Detail
 * ------------------------------------------------------------------ */

export function HandoffPage() {
  const { callSessionId = '' } = useParams()
  const [session, setSession] = useState<CallSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setSession(await api.getCall(callSessionId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the handoff')
    } finally {
      setLoading(false)
    }
  }, [callSessionId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const [redialing, setRedialing] = useState(false)

  // The questions the agent should ask for each missing detail (the approved script lines).
  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const leadId = session?.lead_id
  useEffect(() => {
    if (!leadId) return
    api
      .getLead(leadId)
      .then((detail) => setPrompts(detail.field_prompts))
      .catch(() => {
        /* the panel works without the hints */
      })
  }, [leadId])

  // A phone handoff changes on its own (agent picks up, joins, hangs up): keep it fresh
  // until the human is on the call.
  const phoneHandoff = session ? isPhoneHandoff(session) : false
  const agentJoined = session ? handoffAgentStatus(session)?.label.includes('same call') : false
  useEffect(() => {
    if (!phoneHandoff || agentJoined) return
    const timer = window.setInterval(load, 3000)
    return () => window.clearInterval(timer)
  }, [phoneHandoff, agentJoined, load])

  const redial = async () => {
    setRedialing(true)
    try {
      await api.redialAgent(callSessionId)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not ring the agent')
    } finally {
      setRedialing(false)
    }
  }

  const accept = async (agentName: string) => {
    setAccepting(true)
    try {
      await api.acceptHandoff(callSessionId, agentName)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept the handoff')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Loading handoff…
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-sm text-slate-600">
        {error ?? 'Call session not found.'}
        <div className="mt-4">
          <Link to="/handoffs" className="font-medium text-navy-700 underline">
            All handoffs
          </Link>
        </div>
      </div>
    )
  }

  if (!session.handoff) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-sm text-slate-600">This call has no handoff recorded.</p>
        <Link to={`/calls/${session.id}`} className="mt-4 inline-block font-medium text-navy-700 underline">
          Open the recovery console
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1300px] px-5 py-5">
      <header className="mb-4 flex items-center gap-3">
        <Link
          to="/handoffs"
          className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:text-navy-900"
          title="All handoffs"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Handoff console</h1>
          <p className="text-sm text-slate-500">
            Everything the AI agent captured travels with the call. The customer never repeats
            themselves.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <HandoffCard handoff={session.handoff} onAccept={accept} accepting={accepting} />

          {session.status === 'HANDOFF_REQUESTED' && (
            <HandoffCompletePanel session={session} fieldPrompts={prompts} onChanged={load} />
          )}

          {session.status === 'COMPLETED' && session.submission && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">
                Completed by {session.handoff.accepted_by ?? 'a human agent'}: journey submitted as{' '}
                {session.submission.submission_id}.
              </p>
              <Link
                to={`/completed/${session.id}`}
                className="mt-1 inline-block text-sm font-medium text-emerald-900 underline"
              >
                View the completed journey
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-4">
          {isPhoneHandoff(session) && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <PhoneForwarded className="h-3.5 w-3.5" aria-hidden />
                Live phone handoff
              </h2>
              {(() => {
                const agent = handoffAgentStatus(session)
                const joined = agent?.tone === 'good'
                return (
                  <>
                    <p className="text-sm text-slate-700">
                      The customer is on hold in a Twilio conference. Answering the agent line and
                      pressing 1 puts you on <strong>the same call</strong>, with everything above
                      already captured.
                    </p>
                    <p
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        joined
                          ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/25'
                          : agent?.tone === 'problem'
                            ? 'bg-red-50 text-red-800 ring-red-600/25'
                            : 'bg-amber-50 text-amber-900 ring-amber-600/30'
                      }`}
                    >
                      {agent?.tone === 'problem' && <AlertTriangle className="h-3 w-3" aria-hidden />}
                      {agent?.label ?? 'Waiting for the agent line…'}
                    </p>
                    {agent?.tone === 'problem' && agent.detail && (
                      <p className="mt-2 break-words rounded-md bg-red-50 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-red-800">
                        {agent.detail}
                      </p>
                    )}
                    {!joined && (
                      <button
                        type="button"
                        onClick={redial}
                        disabled={redialing}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:text-navy-900 disabled:opacity-50"
                      >
                        {redialing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <PhoneForwarded className="h-3.5 w-3.5" aria-hidden />
                        )}
                        Ring the agent again
                      </button>
                    )}
                  </>
                )
              })()}
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Session
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Status</span>
                <StatusBadge status={session.status} size="sm" />
              </div>
              {[
                ['Lead', session.lead.id],
                ['Session', session.id],
                ['Started', formatDateTime(session.started_at)],
                ['Handed off', formatDateTime(session.ended_at)],
                ['Consent disclosed', session.recording_consent_disclosed ? 'yes' : 'no'],
                ['Fields captured', String(Object.keys(session.collected_fields).length)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-mono text-[11px] text-navy-800">{value}</span>
                </div>
              ))}
            </div>
            <Link
              to={`/calls/${session.id}`}
              className="mt-3 block rounded-md border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-600 transition hover:text-navy-900"
            >
              Open full call console
            </Link>
          </section>

          <CallHistoryPanel leadId={session.lead_id} currentSessionId={session.id} />

          <section className="flex h-[420px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Full transcript
              </h2>
              <span className="font-mono text-[10px] text-slate-400">
                {session.transcript.length} segments
              </span>
            </header>
            <div className="flex-1 bg-slate-50/60">
              <TranscriptViewer segments={session.transcript} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Queue of open handoffs
 * ------------------------------------------------------------------ */

export function HandoffListPage() {
  const [rows, setRows] = useState<
    Array<{
      sessionId: string
      leadId: string
      name: string
      reason: string | null
      accepted: boolean | null
      createdAt: string | null
      summary: string
    }>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .listHandoffs()
      .then((items) =>
        setRows(
          items.map((item) => ({
            sessionId: item.session_id,
            leadId: item.lead_id,
            name: item.name,
            reason: item.reason,
            accepted: Boolean(item.accepted_by),
            createdAt: item.created_at,
            summary: item.context_summary,
          })),
        ),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-[1300px] px-5 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-navy-900">Handoff console</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Calls the AI agent stepped aside from, waiting for a human. Each one carries the
          context the customer already gave.
        </p>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          Loading handoffs…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-400">
          <Inbox className="mb-2 h-8 w-8" aria-hidden />
          <p className="text-sm">No handoffs waiting.</p>
          <p className="mt-1 text-xs">
            Run the scripted call for lead E-1002 to see a warm handoff end to end.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Link
              key={row.sessionId}
              to={`/handoff/${row.sessionId}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-card transition hover:border-navy-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-700">
                    <UserCheck className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">
                      {row.name}{' '}
                      <span className="font-mono text-[11px] font-normal text-slate-400">
                        {row.leadId}
                      </span>
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-red-700">
                      {row.reason}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">
                    {row.createdAt ? formatDateTime(row.createdAt) : '—'}
                  </p>
                  <p
                    className={`text-[11px] font-medium ${
                      row.accepted ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {row.accepted ? 'accepted' : 'awaiting human'}
                  </p>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
                {row.summary}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
