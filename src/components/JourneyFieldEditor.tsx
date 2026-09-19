import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Loader2, Pencil, X } from 'lucide-react'
import type { JourneyField } from '../lib/types'
import { formatValue } from '../api/client'

/**
 * Agent-Assisted (handout Mode A): the human agent supplies or corrects a journey field
 * while the call is live.
 *
 * The value is validated server-side by the same Python validator that checks spoken
 * answers, and is stored with `source = HUMAN_AGENT` so the audit trail always shows who
 * captured what. Nothing here bypasses the guardrails.
 */
export function JourneyFieldEditor({
  row,
  label,
  approvedPrompt,
  disabled,
  onSave,
  fillLabel,
}: {
  row: JourneyField
  label: string
  approvedPrompt?: string
  disabled: boolean
  onSave: (value: string) => Promise<void>
  /** When set, a detail that is not yet valid gets a clear text button instead of only the pencil. */
  fillLabel?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const valid = row.status === 'VALID'
  const humanCaptured = row.source === 'HUMAN_AGENT'

  const begin = () => {
    setDraft(row.value ?? '')
    setError(null)
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setError(null)
  }

  const save = async () => {
    if (!draft.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave(draft.trim())
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this value')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="px-4 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500">{label}</p>

          {editing ? (
            <div className="mt-1 space-y-1.5">
              <input
                ref={inputRef}
                value={draft}
                disabled={saving}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void save()
                  if (event.key === 'Escape') cancel()
                }}
                placeholder={
                  approvedPrompt ? `Ask: ${approvedPrompt}` : 'Type the customer’s answer…'
                }
                className="w-full rounded-md border border-navy-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving || !draft.trim()}
                  className="inline-flex items-center gap-1 rounded-md bg-navy-800 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-navy-700 disabled:opacity-40"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-3 w-3" aria-hidden />
                  )}
                  Save as human-captured
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:text-navy-900"
                >
                  <X className="h-3 w-3" aria-hidden />
                  Cancel
                </button>
              </div>
              {error && (
                <p className="flex items-start gap-1 text-[11px] text-red-700">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  {error}
                </p>
              )}
            </div>
          ) : (
            <p
              className={`truncate text-sm ${
                valid ? 'font-semibold text-navy-900' : 'text-slate-400'
              }`}
              title={row.value ?? undefined}
            >
              {row.value ? formatValue(row.value) : 'not captured'}
            </p>
          )}
        </div>

        {!editing && (
          <div className="flex shrink-0 items-start gap-1.5">
            <div className="text-right">
              <span
                className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                  valid
                    ? 'bg-emerald-50 text-emerald-700'
                    : row.status === 'INVALID'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {row.status}
              </span>
              <p className="mt-1 font-mono text-[10px] text-slate-400">
                {humanCaptured
                  ? 'human agent'
                  : row.source === 'PREEXISTING'
                    ? 'on file'
                    : `spoken ×${row.attempts}`}
                {row.confidence !== null && !humanCaptured && ` · ${(row.confidence * 100).toFixed(0)}%`}
              </p>
            </div>
            {fillLabel && !valid ? (
              <button
                type="button"
                onClick={begin}
                disabled={disabled}
                className="rounded-md bg-navy-800 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {fillLabel}
              </button>
            ) : (
            <button
              type="button"
              onClick={begin}
              disabled={disabled}
              title={
                disabled
                  ? 'The call has ended — the journey can no longer be edited'
                  : valid
                    ? 'Correct this value'
                    : 'Capture this value for the customer'
              }
              className="rounded-md border border-slate-200 p-1 text-slate-400 transition hover:border-navy-300 hover:text-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Pencil className="h-3 w-3" aria-hidden />
            </button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
