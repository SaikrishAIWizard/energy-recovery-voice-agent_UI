import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  MessageSquareQuote,
  Phone,
  ShieldAlert,
  User,
  UserCheck,
} from 'lucide-react'
import type { Handoff } from '../lib/types'
import { FIELD_LABELS, HANDOFF_REASON_LABELS, formatDateTime, formatValue } from '../api/client'
import { SafetyFlag } from './StatusBadge'

export function HandoffCard({
  handoff,
  onAccept,
  accepting = false,
  compact = false,
}: {
  handoff: Handoff
  onAccept?: (agentName: string) => void
  accepting?: boolean
  compact?: boolean
}) {
  const contact = handoff.known_contact ?? {}

  return (
    <div className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white">
            <ShieldAlert className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-red-900">
              Warm handoff — {HANDOFF_REASON_LABELS[handoff.reason] ?? handoff.reason}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-wide text-red-700">
              reason={handoff.reason}
              {handoff.escalation_signal ? ` · signal=${handoff.escalation_signal}` : ''} · step=
              {handoff.current_step}
            </p>
          </div>
        </div>
        {handoff.accepted_by ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/25">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Accepted by {handoff.accepted_by}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-red-800 ring-1 ring-inset ring-red-600/25">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Awaiting human agent
          </span>
        )}
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {/* Left: identity + reason */}
        <div className="space-y-4">
          <section>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <User className="h-3.5 w-3.5" aria-hidden />
              Caller on the line
            </h4>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-navy-900">
                {contact.first_name ?? '—'} {contact.last_name ?? ''}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                <Phone className="h-3 w-3" aria-hidden />
                {contact.phone ?? '—'}
              </p>
              <p className="text-xs text-slate-600">{contact.email ?? '—'}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-slate-400">
                lead {handoff.lead_id ?? '—'} · last completed step{' '}
                {contact.last_completed_step ?? '—'}
              </p>
            </div>
          </section>

          <section>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden />
              Last thing the customer said
            </h4>
            <blockquote className="rounded-lg border-l-4 border-red-400 bg-red-50 px-3 py-2 text-sm italic text-red-950">
              {handoff.last_customer_message
                ? `“${handoff.last_customer_message}”`
                : 'No customer speech captured.'}
            </blockquote>
          </section>

          <section>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Safety flags
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {handoff.safety_flags.length > 0 ? (
                handoff.safety_flags.map((flag) => <SafetyFlag key={flag} flag={flag} />)
              ) : (
                <span className="text-xs text-slate-400">None raised</span>
              )}
            </div>
          </section>
        </div>

        {/* Right: collected data + summary */}
        <div className="space-y-4">
          <section>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden />
              Captured before handoff — do not re-ask
            </h4>
            <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {Object.entries(handoff.collected_fields).map(([key, value]) => {
                const detail = handoff.field_details?.[key]
                const missingBefore = value === null || value === ''
                // Filled in by the human agent after the handoff, vs heard but never confirmed.
                const addedLater = missingBefore && detail?.status === 'VALID' && Boolean(detail.value)
                const heardOnly = missingBefore && !addedLater && Boolean(detail?.value)
                return (
                  <div key={key} className="flex items-start justify-between gap-3 px-3 py-1.5 text-sm">
                    <dt className="text-slate-500">{FIELD_LABELS[key] ?? key}</dt>
                    <dd className="text-right">
                      <span
                        className={`font-medium ${
                          addedLater ? 'text-emerald-700' : missingBefore ? 'text-slate-400' : 'text-navy-900'
                        }`}
                      >
                        {addedLater
                          ? `${formatValue(detail?.value)} (added by agent)`
                          : heardOnly
                            ? `heard: ${formatValue(detail?.value)} (unconfirmed)`
                            : missingBefore
                              ? 'not captured'
                              : formatValue(value)}
                      </span>
                      {detail && (
                        <span className="block font-mono text-[10px] text-slate-400">
                          {detail.source.replace('_', ' ').toLowerCase()}
                          {detail.confidence !== null ? ` · ${Math.round(detail.confidence * 100)}%` : ''}
                        </span>
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>
            {handoff.outstanding_fields?.length > 0 && (
              <p className="mt-1.5 text-xs text-slate-500">
                <span className="font-semibold text-slate-600">Still to collect:</span>{' '}
                {handoff.outstanding_fields.map((name) => FIELD_LABELS[name] ?? name).join(', ')}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Recording disclosure:{' '}
              <span className={handoff.recording_disclosed ? 'font-medium text-emerald-700' : 'font-medium text-amber-700'}>
                {handoff.recording_disclosed ? 'made before any data collection' : 'not recorded'}
              </span>
            </p>
          </section>

          {!compact && (
            <section>
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Conversation summary
              </h4>
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                {handoff.context_summary}
              </p>
            </section>
          )}

          <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
            handoff #{handoff.id} · {formatDateTime(handoff.created_at)}
          </p>
        </div>
      </div>

      {onAccept && !handoff.accepted_by && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">
            Accepting adds the human agent to the transcript. The customer is never asked to
            repeat anything.
          </p>
          <button
            type="button"
            disabled={accepting}
            onClick={() => onAccept('Aarav (Human Agent)')}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <UserCheck className="h-4 w-4" aria-hidden />
            {accepting ? 'Accepting…' : 'Human agent accepted'}
          </button>
        </div>
      )}
    </div>
  )
}
