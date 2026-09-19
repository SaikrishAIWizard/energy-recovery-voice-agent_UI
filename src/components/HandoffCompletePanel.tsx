import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, CheckCircle2, ClipboardCheck, Loader2, ShieldAlert } from 'lucide-react'
import { api, FIELD_LABELS, fieldRows } from '../api/client'
import type { CallSession } from '../lib/types'
import { JourneyFieldEditor } from './JourneyFieldEditor'

function savedAgentName(): string {
  try {
    return window.localStorage.getItem('agentName') || 'Human Agent'
  } catch {
    return 'Human Agent'
  }
}

/**
 * Handoff console: the human agent fills in whatever the AI did not get, then submits.
 *
 * Every value goes through the same validators as a spoken answer (a person cannot push an
 * invalid value in either) and is stored as HUMAN_AGENT. Submitting needs the agent to say they
 * read the details back and the customer confirmed them. When life support is declared the agent
 * must also validate that with the customer (the AI itself never submits such a journey).
 */
export function HandoffCompletePanel({
  session,
  fieldPrompts,
  onChanged,
}: {
  session: CallSession
  fieldPrompts: Record<string, string>
  onChanged: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [agentName, setAgentName] = useState(savedAgentName)
  const [confirmed, setConfirmed] = useState(false)
  const [lifeConfirmed, setLifeConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = fieldRows(session)
  const missing = rows.filter((row) => row.status !== 'VALID').map((row) => row.field_name)
  const lifeSupportDeclared = rows.find((row) => row.field_name === 'life_support')?.value === 'YES'
  const name = agentName.trim() || 'Human Agent'
  const ready = missing.length === 0
  // Life support declared: a person may submit, but only after validating it with the customer.
  const lifeValidated = lifeSupportDeclared && lifeConfirmed
  // Why Submit is not available yet, in plain words (nothing is left greyed out unexplained).
  const blockedReason =
    missing.length > 0
      ? `Submit is available once all six details are filled in. ${missing.length} still to go: use the "Fill in" buttons above.`
      : !confirmed
        ? 'Tick the read-back box above to enable Submit.'
        : lifeSupportDeclared && !lifeConfirmed
          ? 'Tick the life-support validation to enable Submit.'
          : null

  const rememberName = (value: string) => {
    setAgentName(value)
    try {
      window.localStorage.setItem('agentName', value)
    } catch {
      /* the name just is not remembered */
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await api.submitHandoffJourney(session.id, name, confirmed, lifeValidated)
      navigate(`/completed/${session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the journey')
      setSubmitting(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
          Complete the journey
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
          {6 - missing.length} of 6 ready
        </span>
      </header>

      <p className="border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] leading-relaxed text-slate-500">
        Ask the customer for each missing detail (the question to ask is shown as you edit). Values are
        checked by the same rules as a spoken answer and saved as <code className="font-mono">HUMAN_AGENT</code>.
        When everything is filled in, read it all back, then submit.
      </p>

      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
        <label htmlFor="agent-name" className="text-xs text-slate-500">
          You are
        </label>
        <input
          id="agent-name"
          value={agentName}
          onChange={(event) => rememberName(event.target.value)}
          className="w-44 rounded-md border border-slate-300 px-2 py-1 text-sm text-navy-900 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
        />
        <span className="text-[11px] text-slate-400">recorded on every value you enter</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <JourneyFieldEditor
            key={row.field_name}
            row={row}
            label={FIELD_LABELS[row.field_name] ?? row.field_name}
            approvedPrompt={fieldPrompts[row.field_name]}
            disabled={submitting}
            fillLabel="Fill in"
            onSave={async (value) => {
              await api.captureField(session.id, row.field_name, value, name)
              await onChanged()
            }}
          />
        ))}
      </ul>

      <div className="space-y-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3">
        {lifeSupportDeclared && (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
            <p className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                <strong>Life-support equipment was declared: a vulnerable-customer case.</strong> Ask the
                customer to confirm it (the question is shown when you edit Life support). Do not ask for
                medical details. If they say it was not right, change Life support to No above instead.
              </span>
            </p>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-amber-950">
              <input
                type="checkbox"
                data-testid="life-support-validation"
                checked={lifeConfirmed}
                disabled={submitting}
                onChange={(event) => setLifeConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-amber-400"
              />
              I confirmed with the customer that someone at the property uses life-support equipment. I am
              handling this as a vulnerable-customer case and have recorded no medical details.
            </label>
          </div>
        )}

        {missing.length > 0 ? (
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Still to collect:</span>{' '}
            {missing.map((field) => FIELD_LABELS[field] ?? field).join(', ')}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Every detail is filled in.
          </p>
        )}

        <label
          className="flex cursor-pointer items-start gap-2 text-sm text-slate-700"
        >
          <input
            type="checkbox"
            checked={confirmed}
            disabled={submitting}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          I read these details back to the customer and they confirmed they are correct.
        </label>

        {error && (
          <p className="flex items-start gap-1.5 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!ready || !confirmed || (lifeSupportDeclared && !lifeConfirmed) || submitting}
          title={blockedReason ?? undefined}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <BadgeCheck className="h-4 w-4" aria-hidden />
          )}
          {submitting ? 'Submitting…' : 'Submit journey'}
        </button>
        {blockedReason && (
          <p className="text-[11px] text-slate-500" data-testid="submit-blocked-reason">
            {blockedReason}
          </p>
        )}
      </div>
    </section>
  )
}
