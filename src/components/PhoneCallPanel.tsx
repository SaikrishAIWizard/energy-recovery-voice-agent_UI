import { useState } from 'react'
import { AlertTriangle, Loader2, Monitor, PhoneCall, PhoneForwarded } from 'lucide-react'
import type { CallSession } from '../lib/types'
import { customerCallStatus, handoffAgentStatus, isLivePhoneCall } from '../lib/phone'

const TONE: Record<string, string> = {
  progress: 'bg-amber-50 text-amber-900 ring-amber-600/30',
  good: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
  problem: 'bg-red-50 text-red-800 ring-red-600/25',
}

/**
 * The call channel for an agent-driven session.
 *
 * By default the call runs in this browser (mic / quick replies). "Start call by agent"
 * hands it to the assistant, which phones the customer through Twilio and holds the real
 * conversation; the transcript below then fills in live from the phone call.
 */
export function PhoneCallPanel({
  session,
  liveCalls,
  dialOverride,
  disabled,
  onDial,
}: {
  session: CallSession
  liveCalls: boolean
  dialOverride: boolean
  disabled: boolean
  onDial: () => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const [dialling, setDialling] = useState(false)

  if (session.mode !== 'AGENT_DRIVEN') return null

  const live = isLivePhoneCall(session)
  const status = customerCallStatus(session)
  const agent = handoffAgentStatus(session)
  const hadPhoneCall = session.audit_events.some((e) => e.event_type === 'PHONE_CALL_PLACED')

  // Nothing to offer once the call is over, unless there was a phone call worth summarising.
  if (session.status !== 'ACTIVE' && !hadPhoneCall) return null

  const dial = async () => {
    setError(null)
    setDialling(true)
    try {
      await onDial()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place the call')
    } finally {
      setDialling(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-card">
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <PhoneCall className="h-3.5 w-3.5" aria-hidden />
          Call channel
        </h2>
        {(status || agent) && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
              TONE[(agent ?? status)!.tone]
            }`}
          >
            {(agent ?? status)!.tone === 'progress' && live && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            )}
            {(agent ?? status)!.label}
          </span>
        )}
      </header>

      <div className="space-y-3 px-4 py-3">
        {live ? (
          <p className="text-sm text-slate-700">
            <strong className="font-semibold text-navy-900">The assistant is on a real phone call.</strong>{' '}
            The customer talks on their phone and the transcript below updates live. The microphone
            and quick replies are off. <em>End call</em> hangs up; <em>Handoff to human</em> puts the
            customer on hold and dials your agent into the same call.
          </p>
        ) : session.status === 'ACTIVE' ? (
          <>
            <div className="flex items-start gap-2 text-sm text-slate-700">
              <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <p>
                This call is running in the browser. To have the assistant phone{' '}
                <strong className="font-semibold text-navy-900">
                  {dialOverride ? 'your test number' : session.lead.phone}
                </strong>{' '}
                and hold the real conversation instead, start the call by agent.
              </p>
            </div>

            <button
              type="button"
              onClick={dial}
              disabled={!liveCalls || disabled || dialling}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {dialling ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <PhoneForwarded className="h-4 w-4" aria-hidden />
              )}
              {dialling ? 'Placing the call…' : 'Start call by agent'}
            </button>

            {!liveCalls && (
              <p className="text-xs leading-relaxed text-slate-500">
                Phone calls are not set up. Add <code className="font-mono">TWILIO_ACCOUNT_SID</code>,{' '}
                <code className="font-mono">TWILIO_AUTH_TOKEN</code>,{' '}
                <code className="font-mono">TWILIO_FROM_NUMBER</code> and{' '}
                <code className="font-mono">PUBLIC_BASE_URL</code> to <code className="font-mono">backend/.env</code>{' '}
                and restart the backend.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-600">The phone call has ended.</p>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </div>
        )}
      </div>
    </section>
  )
}
