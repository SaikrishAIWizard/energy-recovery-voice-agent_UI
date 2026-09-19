import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, FileAudio, Loader2, UploadCloud, X } from 'lucide-react'
import { api, FIELD_LABELS } from '../api/client'
import type { HealthResponse, LeadQueueItem } from '../lib/types'

const MAX_BYTES = 40 * 1024 * 1024
const NEW_LEAD = '__new__'
const CHECKLIST = [
  'property_address',
  'move_in_date',
  'energy_requirement',
  'concession_status',
  'life_support',
  'contact_preference',
]

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-200 disabled:bg-slate-50'

export function UploadRecordingPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)

  const [leads, setLeads] = useState<LeadQueueItem[]>([])
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [leadChoice, setLeadChoice] = useState(params.get('lead') ?? '')
  const [newLead, setNewLead] = useState({ firstName: '', phone: '', email: '' })
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listLeads().then(setLeads).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load leads'))
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  const noStt = health !== null && health.voice_providers.server_stt.length === 0
  const creatingLead = leadChoice === NEW_LEAD
  const leadReady = creatingLead
    ? Boolean(newLead.firstName.trim() && newLead.phone.trim() && newLead.email.includes('@'))
    : Boolean(leadChoice)
  const canSubmit = Boolean(file) && leadReady && !busy && !noStt

  const pick = (candidate: File | undefined | null) => {
    if (!candidate) return
    setError(null)
    if (candidate.type && !/^(audio|video)\//.test(candidate.type)) {
      setError(`"${candidate.name}" is not an audio file (${candidate.type}).`)
      return
    }
    if (candidate.size > MAX_BYTES) {
      setError(`That file is ${formatBytes(candidate.size)}; the limit is ${formatBytes(MAX_BYTES)}.`)
      return
    }
    setFile(candidate)
  }

  const submit = async () => {
    if (!file || !canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.uploadRecording(
        file,
        creatingLead ? { newLead } : { leadId: leadChoice },
      )
      navigate(`/recordings/${result.session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <header className="mb-5 flex items-center gap-3">
        <Link
          to="/"
          className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:text-navy-900"
          title="Back to queue"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Upload a call recording</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            We transcribe it and check it against the journey checklist. Complete: the journey is
            submitted. Anything missing: the lead goes to the recovery queue.
          </p>
        </div>
      </header>

      {noStt && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            No server-side speech-to-text is configured, so recordings can&apos;t be transcribed. Set{' '}
            <code className="font-mono">DEEPGRAM_API_KEY</code> or{' '}
            <code className="font-mono">ASSEMBLYAI_API_KEY</code> in{' '}
            <code className="font-mono">backend/.env</code> and restart the backend.
          </span>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* 1. Lead */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            1 · Whose call is it?
          </h2>
          <select
            value={leadChoice}
            onChange={(event) => setLeadChoice(event.target.value)}
            disabled={busy}
            className={inputClass}
            aria-label="Lead"
          >
            <option value="" disabled>
              Select a lead…
            </option>
            {leads.map((item) => (
              <option key={item.lead.id} value={item.lead.id}>
                {item.lead.id} · {item.lead.first_name} {item.lead.last_name ?? ''}
              </option>
            ))}
            <option value={NEW_LEAD}>+ New lead…</option>
          </select>

          {creatingLead && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <input
                className={inputClass}
                placeholder="First name"
                value={newLead.firstName}
                onChange={(event) => setNewLead({ ...newLead, firstName: event.target.value })}
                disabled={busy}
                aria-label="First name"
              />
              <input
                className={inputClass}
                placeholder="Phone"
                value={newLead.phone}
                onChange={(event) => setNewLead({ ...newLead, phone: event.target.value })}
                disabled={busy}
                aria-label="Phone"
              />
              <input
                className={inputClass}
                type="email"
                placeholder="Email"
                value={newLead.email}
                onChange={(event) => setNewLead({ ...newLead, email: event.target.value })}
                disabled={busy}
                aria-label="Email"
              />
            </div>
          )}
        </section>

        {/* 2. File */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            2 · Recording
          </h2>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.webm"
            className="hidden"
            onChange={(event) => pick(event.target.files?.[0])}
          />
          {file ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileAudio className="h-5 w-5 shrink-0 text-navy-600" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy-900">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                disabled={busy}
                className="rounded p-1 text-slate-400 transition hover:text-slate-700 disabled:opacity-50"
                title="Remove"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                pick(event.dataTransfer.files?.[0])
              }}
              className={`flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-9 text-center transition ${
                dragging
                  ? 'border-navy-500 bg-navy-50'
                  : 'border-slate-300 bg-slate-50 hover:border-navy-400 hover:bg-navy-50/50'
              }`}
            >
              <UploadCloud className="mb-2 h-7 w-7 text-slate-400" aria-hidden />
              <span className="text-sm font-medium text-navy-800">
                Drop an audio file here, or click to browse
              </span>
              <span className="mt-1 text-xs text-slate-500">
                MP3, WAV, M4A, OGG, FLAC or WebM · up to {formatBytes(MAX_BYTES)}
              </span>
            </button>
          )}
        </section>

        {/* What is checked */}
        <section className="rounded-xl border border-navy-200 bg-navy-50 p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-navy-700">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            The checklist
          </h2>
          <p className="mb-2 text-xs text-navy-700">
            The recording has to cover all six. Anything already on file for the lead, or found in
            an earlier upload, counts.
          </p>
          <ul className="grid gap-x-4 gap-y-1 text-sm text-navy-900 sm:grid-cols-2">
            {CHECKLIST.map((name) => (
              <li key={name} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-navy-400" aria-hidden />
                {FIELD_LABELS[name]}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex items-center justify-end gap-3">
          {busy && (
            <span className="text-xs text-slate-500">
              Transcribing and checking… this can take up to a minute.
            </span>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-md bg-navy-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <UploadCloud className="h-4 w-4" aria-hidden />
            )}
            {busy ? 'Analysing…' : 'Analyse recording'}
          </button>
        </div>
      </div>
    </div>
  )
}
