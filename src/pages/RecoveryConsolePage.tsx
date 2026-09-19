import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ClipboardList,
  Info,
  Loader2,
  PhoneOff,
  PlayCircle,
  ShieldCheck,
  UserCheck,
  Zap,
} from 'lucide-react'
import {
  api,
  FIELD_LABELS,
  formatDateTime,
  formatValue,
  openCallStream,
} from '../api/client'
import type { CallSession, LeadDetail, TurnResponse } from '../lib/types'
import { DncBadge, SafetyFlag, StatusBadge } from '../components/StatusBadge'
import { JourneyStepper } from '../components/JourneyStepper'
import { TranscriptViewer } from '../components/TranscriptViewer'
import { VoiceControls, speakText, stopSpeaking, ttsSupported } from '../components/VoiceControls'
import type { UtteranceSource } from '../components/VoiceControls'
import { HandoffCard } from '../components/HandoffCard'
import { PhoneCallPanel } from '../components/PhoneCallPanel'
import { CallHistoryPanel } from '../components/CallHistoryPanel'
import { isLivePhoneCall } from '../lib/phone'
import { JourneyFieldEditor } from '../components/JourneyFieldEditor'

const TERMINAL = ['COMPLETED', 'DECLINED', 'HANDOFF_REQUESTED', 'DNC_BLOCKED', 'INCOMPLETE']

/**
 * The canned customer reply for "Play scripted call". At a yes/no moment (a read-back, the
 * busy question, the closing question) the reply depends on the state; otherwise on the step.
 */
function scriptedReply(turns: Record<string, string>, state: string, step: string): string | undefined {
  return turns[`state:${state}`] ?? turns[step]
}

function Panel({
  title,
  icon: Icon,
  children,
  className = '',
  action,
}: {
  title: string
  icon?: typeof Info
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

export function RecoveryConsolePage() {
  const { callSessionId = '' } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState<CallSession | null>(null)
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [assistedMode, setAssistedMode] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [streamLive, setStreamLive] = useState(false)
  const [busy, setBusy] = useState(false)
  // Which server-side STT providers the backend can actually reach. Empty by default,
  // which is the normal no-credentials case — the browser transcribes instead.
  const [serverStt, setServerStt] = useState<string[]>([])
  // What the backend can do over the phone (Twilio credentials + public URL).
  const [liveCalls, setLiveCalls] = useState(false)
  const [dialOverride, setDialOverride] = useState(false)

  const playAbort = useRef(false)
  // While the assistant is on a real phone call the customer talks on their phone; the
  // browser microphone, quick replies and spoken replies would only talk over it.
  const onPhone = session ? isLivePhoneCall(session) : false

  useEffect(() => {
    let cancelled = false
    api
      .health()
      .then((data) => {
        if (cancelled) return
        setServerStt(data.voice_providers.server_stt ?? [])
        setLiveCalls(Boolean(data.capabilities.telephony?.live_calls))
        setDialOverride(Boolean(data.capabilities.telephony?.dial_override_active))
      })
      .catch(() => {
        /* the console works fine without this — it only gates the upload button */
      })
    return () => {
      cancelled = true
    }
  }, [])

  /* ---------------- data loading ---------------- */
  const load = useCallback(async () => {
    try {
      const data = await api.getCall(callSessionId)
      setSession(data)
      setError(null)
      if (!leadDetail || leadDetail.lead.id !== data.lead_id) {
        setLeadDetail(await api.getLead(data.lead_id))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the call')
    } finally {
      setLoading(false)
    }
  }, [callSessionId, leadDetail])

  useEffect(() => {
    setLoading(true)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callSessionId])

  /* ---------------- live feed ---------------- */
  useEffect(() => {
    if (!callSessionId) return
    return openCallStream(callSessionId, (incoming) => setSession(incoming), setStreamLive)
  }, [callSessionId])

  /* ---------------- speaking ---------------- */
  const speakMessages = useCallback(
    (messages: string[]) => {
      if (!autoSpeak || assistedMode || onPhone) return
      const text = messages.join(' ')
      if (text) speakText(text, true)
    },
    [assistedMode, autoSpeak, onPhone],
  )

  const applyTurn = useCallback(
    (turn: TurnResponse) => {
      setSession(turn.session)
      setNotes(turn.system_notes ?? [])
      if (turn.agent_messages.length > 0) {
        if (assistedMode) setPendingDraft(turn.agent_messages.join('\n\n'))
        else speakMessages(turn.agent_messages)
      }
    },
    [assistedMode, speakMessages],
  )

  /* ---------------- actions ---------------- */
  const submitUtterance = async (text: string, source: UtteranceSource) => {
    if (!session || busy) return
    setBusy(true)
    stopSpeaking()
    try {
      const turn = await api.sendUtterance(session.id, text, source)
      applyTurn(turn)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Turn failed')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Server-side speech-to-text turn.
   *
   * Uploads the audio and lets the backend transcribe it, then applies the resulting turn.
   * The transcript is screened by the same safety engine and validators as anything the
   * customer types — an external vendor does not get to bypass the guardrails.
   *
   * Errors are deliberately not caught here: VoiceControls shows them next to the button
   * that caused them, which is where the operator is looking.
   */
  const submitAudio = async (file: File) => {
    if (!session) return
    setBusy(true)
    stopSpeaking()
    try {
      const turn = await api.uploadAudioTurn(session.id, file, file.type || 'audio/webm')
      applyTurn(turn)
    } finally {
      setBusy(false)
    }
  }

  const playScript = async () => {
    if (!session || !leadDetail) return
    playAbort.current = false
    setPlaying(true)
    const used: Record<string, number> = {}
    let current = session

    try {
      for (let guard = 0; guard < 16; guard += 1) {
        const open = current.status === 'ACTIVE' || current.state === 'CLOSING'
        if (playAbort.current || !open) break
        const step = current.current_step
        const key = `${current.state}:${step}`
        const reply = scriptedReply(leadDetail.scripted_turns, current.state, step)
        if (!reply) {
          setNotes([`No scripted customer reply for step '${step}' — stopping playback.`])
          break
        }
        used[key] = (used[key] ?? 0) + 1
        if (used[key] > 2) break

        const turn = await api.sendUtterance(current.id, reply, 'SIMULATED')
        current = turn.session
        setSession(current)
        setNotes(turn.system_notes ?? [])
        if (turn.agent_messages.length > 0) speakMessages(turn.agent_messages)
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scripted playback failed')
    } finally {
      setPlaying(false)
    }
  }

  /** "Start call by agent": the assistant phones the customer. Errors show in the panel. */
  const startPhoneCall = async () => {
    if (!session) return
    setBusy(true)
    stopSpeaking()
    try {
      applyTurn(await api.dialCall(session.id))
    } finally {
      setBusy(false)
    }
  }

  const requestHandoff = async () => {
    if (!session) return
    setBusy(true)
    try {
      const turn = await api.requestHandoff(session.id, 'CUSTOMER_REQUEST')
      applyTurn(turn)
    } finally {
      setBusy(false)
    }
  }

  const endCall = async () => {
    if (!session) return
    setBusy(true)
    stopSpeaking()
    try {
      const turn = await api.endCall(session.id)
      applyTurn(turn)
    } finally {
      setBusy(false)
    }
  }

  /* ---------------- derived ---------------- */
  // CLOSING = journey submitted, agent still asking "anything else?": the customer can reply.
  const isTerminal = session ? TERMINAL.includes(session.status) && session.state !== 'CLOSING' : false
  const scriptedPrompts = leadDetail?.field_prompts ?? {}
  const dataFields = useMemo(
    () =>
      session
        ? session.journey_fields.filter((row) =>
            [
              'property_address',
              'move_in_date',
              'energy_requirement',
              'concession_status',
              'life_support',
              'contact_preference',
            ].includes(row.field_name),
          )
        : [],
    [session],
  )

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Loading call session…
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" aria-hidden />
        <p className="text-sm text-slate-600">{error ?? 'Call session not found.'}</p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-navy-700 underline">
          Back to the recovery queue
        </Link>
      </div>
    )
  }

  const dncBlocked = session.status === 'DNC_BLOCKED'

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-5">
      {/* Header */}
      <header className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link
              to="/"
              className="mt-1 rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:text-navy-900"
              title="Back to queue"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-navy-900">
                  {session.lead.first_name} {session.lead.last_name ?? ''}
                </h1>
                <StatusBadge status={session.status} />
                <DncBadge dnc={session.lead.dnc_status} />
                {session.recording_consent_disclosed && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-600/25">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Recording disclosed
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-[11px] text-slate-400">
                lead {session.lead.id} · session {session.id} · state {session.state} · mode{' '}
                {assistedMode ? 'AGENT_ASSISTED' : session.mode}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                streamLive
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-slate-100 text-slate-500'
              }`}
              title="WebSocket live session feed"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  streamLive ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              {streamLive ? 'Live' : 'Polling'}
            </span>

            {!isTerminal && (
              <>
                <button
                  type="button"
                  onClick={requestHandoff}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <UserCheck className="h-3.5 w-3.5" aria-hidden />
                  Handoff to human
                </button>
                <button
                  type="button"
                  onClick={endCall}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-navy-900 disabled:opacity-50"
                >
                  <PhoneOff className="h-3.5 w-3.5" aria-hidden />
                  End call
                </button>
              </>
            )}
            {session.status === 'HANDOFF_REQUESTED' && (
              <button
                type="button"
                onClick={() => navigate(`/handoff/${session.id}`)}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <UserCheck className="h-3.5 w-3.5" aria-hidden />
                Open handoff console
              </button>
            )}
            {session.status === 'COMPLETED' && (
              <button
                type="button"
                onClick={() => navigate(`/completed/${session.id}`)}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                View submitted journey
              </button>
            )}
          </div>
        </div>

        {dncBlocked && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <Ban className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <div>
              <p className="font-medium">Do-Not-Call block — no call was placed.</p>
              <p className="text-xs text-slate-500">
                The register check runs before a call session can exist. No prompts were spoken
                and no data was collected. Audit code: {session.outcome_detail}.
              </p>
            </div>
          </div>
        )}

        {session.status === 'DECLINED' && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <PhoneOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">
                {{
                  CALLBACK_REQUESTED: 'Customer was busy and asked for a callback — logged, call ended.',
                  LEFT_FOR_LATER: 'Customer was busy and will continue later — logged, call ended.',
                  DO_NOT_CALL_REQUESTED: 'Customer asked not to be called again — request logged, call ended.',
                }[session.outcome_detail ?? ''] ?? 'Customer declined — call ended immediately.'}
              </p>
              <p className="text-xs text-red-700">
                The refusal was respected: no retry, no re-ask, no pressure loop.
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Body */}
      <div className="grid gap-4 xl:grid-cols-12">
        {/* Left rail */}
        <div className="space-y-4 xl:col-span-3">
          <Panel title="Lead record" icon={ClipboardList}>
            <dl className="divide-y divide-slate-100 px-4 py-2 text-sm">
              {[
                ['Lead ID', session.lead.id],
                ['Phone', session.lead.phone],
                ['Email', session.lead.email],
                ['Last completed step', session.lead.last_completed_step],
                ['Resumed at', session.resume_step ?? '—'],
                ['Dialled via', session.dial_provider ?? '—'],
                ['Call started', formatDateTime(session.started_at)],
                ['Call ended', session.ended_at ? formatDateTime(session.ended_at) : 'in progress'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 py-1.5">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-right text-xs font-medium text-navy-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <CallHistoryPanel leadId={session.lead_id} currentSessionId={session.id} />

          <Panel title="Journey progress" icon={PlayCircle}>
            <div className="px-4 py-3">
              <JourneyStepper steps={session.journey_progress} />
            </div>
          </Panel>

          {session.safety_flags.length > 0 && (
            <Panel title="Safety flags" icon={ShieldCheck}>
              <div className="flex flex-wrap gap-1.5 px-4 py-3">
                {session.safety_flags.map((flag) => (
                  <SafetyFlag key={flag} flag={flag} />
                ))}
              </div>
            </Panel>
          )}

          {leadDetail?.scenario_notes && (
            <Panel title="Demo scenario" icon={Info}>
              <p className="px-4 py-3 text-xs leading-relaxed text-slate-600">
                {leadDetail.scenario_notes}
              </p>
              {leadDetail.expected_outcome && (
                <p className="border-t border-slate-100 px-4 py-2 font-mono text-[10px] uppercase tracking-wide text-slate-400">
                  expected: {leadDetail.expected_outcome}
                </p>
              )}
            </Panel>
          )}
        </div>

        {/* Transcript */}
        <div className="flex flex-col gap-4 xl:col-span-5">
          <PhoneCallPanel
            session={session}
            liveCalls={liveCalls}
            dialOverride={dialOverride}
            disabled={busy}
            onDial={startPhoneCall}
          />

          <Panel
            title="Live transcript"
            icon={Zap}
            className="flex min-h-[420px] flex-1 flex-col"
            action={
              <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                {session.transcript.length} segments
              </span>
            }
          >
            <div className="min-h-[380px] flex-1 bg-slate-50/60">
              <TranscriptViewer
                segments={session.transcript}
                onSpeak={(text) => speakText(text, ttsSupported())}
              />
            </div>
            <div className="border-t border-slate-200 p-3">
              <VoiceControls
                disabled={isTerminal || busy || playing || onPhone}
                disabledHint={onPhone ? 'The customer is on the phone call' : undefined}
                demoReplies={session.demo_replies}
                scriptedTurn={
                  leadDetail
                    ? scriptedReply(leadDetail.scripted_turns, session.state, session.current_step) ?? null
                    : null
                }
                onSubmit={submitUtterance}
                onPlayScript={playScript}
                playing={playing}
                autoSpeak={autoSpeak}
                onAutoSpeakChange={setAutoSpeak}
                assistedMode={assistedMode}
                onAssistedModeChange={(value) => {
                  setAssistedMode(value)
                  if (!value) setPendingDraft(null)
                }}
                pendingDraft={pendingDraft}
                onApproveDraft={() => {
                  if (pendingDraft) speakText(pendingDraft, true)
                  setPendingDraft(null)
                }}
                serverStt={serverStt}
                onSubmitAudio={submitAudio}
              />
            </div>
          </Panel>
        </div>

        {/* Right rail */}
        <div className="space-y-4 xl:col-span-4">
          {session.handoff && (
            <HandoffCard handoff={session.handoff} compact />
          )}

          {session.submission && (
            <Panel title="Submitted journey" icon={CheckCircle2}>
              <div className="px-4 py-3">
                <p className="text-sm font-semibold text-emerald-800">
                  {session.submission.submission_id}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDateTime(session.submission.created_at)}
                </p>
                <dl className="mt-2 space-y-1">
                  {Object.entries(session.submission.payload).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3 text-xs">
                      <dt className="text-slate-500">{FIELD_LABELS[key] ?? key}</dt>
                      <dd className="font-medium text-navy-900">{formatValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Panel>
          )}

          <Panel
            title="Journey fields"
            icon={ClipboardList}
            action={
              <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                {session.missing_required_fields.length === 0
                  ? 'all required captured'
                  : `${session.missing_required_fields.length} outstanding`}
              </span>
            }
          >
            {!isTerminal && (
              <p className="border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] leading-relaxed text-slate-500">
                Agent-assisted: capture or correct any value for the customer. It is validated
                by the same rules as a spoken answer and stored as <code className="font-mono">HUMAN_AGENT</code>.
              </p>
            )}
            <ul className="divide-y divide-slate-100">
              {dataFields.map((row) => (
                <JourneyFieldEditor
                  key={row.field_name}
                  row={row}
                  label={FIELD_LABELS[row.field_name] ?? row.field_name}
                  approvedPrompt={scriptedPrompts[row.field_name]}
                  disabled={isTerminal || busy || playing}
                  onSave={async (value) => {
                    const turn = await api.captureField(session.id, row.field_name, value)
                    applyTurn(turn)
                  }}
                />
              ))}
            </ul>
          </Panel>

          {notes.length > 0 && (
            <Panel title="System notes" icon={Info}>
              <ul className="space-y-1.5 px-4 py-3">
                {notes.map((note, index) => (
                  <li key={index} className="text-xs leading-relaxed text-slate-600">
                    {note}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel
            title="Audit trail"
            icon={ShieldCheck}
            action={
              <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                {session.audit_events.length} events
              </span>
            }
          >
            <ul className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {session.audit_events.map((event) => (
                <li key={event.id} className="px-4 py-1.5">
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
          </Panel>
        </div>
      </div>
    </div>
  )
}
