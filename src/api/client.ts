import type {
  CallSession,
  DashboardSummary,
  DatabaseIndex,
  DatabaseRows,
  Handoff,
  HandoffReason,
  RecordingUploadResponse,
  HandoffListItem,
  SessionSummary,
  HealthResponse,
  JourneyField,
  LeadDetail,
  LeadQueueItem,
  StartCallResponse,
  Submission,
  TranscriptSegment,
  TurnResponse,
} from '../lib/types'

/**
 * Base URL of the FastAPI backend. Override with VITE_API_BASE_URL in a .env file.
 * No API key, no auth — the demo is local by design.
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000'

export const WS_BASE_URL: string = API_BASE_URL.replace(/^http/, 'ws')

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    throw new ApiError(
      `Cannot reach the backend at ${API_BASE_URL}. Is it running? (uvicorn app.main:app)`,
      0,
    )
  }

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* keep the status text */
    }
    throw new ApiError(detail, response.status)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  health: () => request<HealthResponse>('/health'),

  databaseTables: (signal?: AbortSignal) =>
    request<DatabaseIndex>('/internal/database/tables', { signal, cache: 'no-store' }),
  databaseRows: (
    table: string,
    options: { limit: number; offset: number; q: string; sort_by?: string; direction: 'asc' | 'desc' },
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams({
      limit: String(options.limit), offset: String(options.offset),
      q: options.q, direction: options.direction,
    })
    if (options.sort_by) params.set('sort_by', options.sort_by)
    return request<DatabaseRows>(
      `/internal/database/tables/${encodeURIComponent(table)}?${params}`,
      { signal, cache: 'no-store' },
    )
  },

  listLeads: () => request<LeadQueueItem[]>('/leads'),
  getLead: (leadId: string) => request<LeadDetail>(`/leads/${leadId}`),
  /** Every call ever made for a lead, newest first. */
  leadSessions: (leadId: string) => request<SessionSummary[]>(`/leads/${leadId}/sessions`),
  /** Every call waiting on a human — not only each lead's latest call. */
  listHandoffs: () => request<HandoffListItem[]>('/handoffs'),

  startCall: (leadId: string, mode: 'AGENT_DRIVEN' | 'AGENT_ASSISTED' = 'AGENT_DRIVEN', force = false) =>
    request<StartCallResponse>(`/calls/start/${leadId}`, {
      method: 'POST',
      body: JSON.stringify({ mode, force }),
    }),

  sendUtterance: (
    callSessionId: string,
    text: string,
    source: 'BROWSER_SPEECH' | 'SIMULATED' | 'STT_PROVIDER' | 'HUMAN_TYPED' = 'SIMULATED',
    transcriptionConfidence?: number,
  ) =>
    request<TurnResponse>(`/calls/${callSessionId}/utterance`, {
      method: 'POST',
      body: JSON.stringify({
        text,
        source,
        transcription_confidence: transcriptionConfidence ?? null,
      }),
    }),

  /**
   * Server-side speech-to-text turn.
   *
   * Posts raw audio to the backend, which transcribes it with whichever STT provider is
   * configured and then feeds the transcript through the same safety engine and
   * validators as any other turn. The transcript is not trusted just because a vendor
   * produced it.
   *
   * Throws ApiError with status 503 when no provider is configured — in that case the
   * browser is the transcriber, which is the default and needs no credentials.
   */
  uploadAudioTurn: (callSessionId: string, audio: Blob, mimeType = 'audio/webm') =>
    request<TurnResponse>(`/calls/${callSessionId}/audio`, {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: audio,
    }),

  /**
   * Upload a finished call recording. The backend transcribes it, checks the journey
   * checklist and either submits the journey (everything found) or leaves the lead in the
   * recovery queue (something missing). Raw audio body, like uploadAudioTurn.
   */
  uploadRecording: (
    file: File,
    target: { leadId: string } | { newLead: { firstName: string; phone: string; email: string } },
  ) => {
    const params = new URLSearchParams({ filename: file.name })
    if ('leadId' in target) {
      params.set('lead_id', target.leadId)
    } else {
      params.set('new_first_name', target.newLead.firstName)
      params.set('new_phone', target.newLead.phone)
      params.set('new_email', target.newLead.email)
    }
    return request<RecordingUploadResponse>(`/recordings/upload?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
  },

  /** "Start call by agent": the assistant phones the customer through Twilio. */
  dialCall: (callSessionId: string) =>
    request<TurnResponse>(`/calls/${callSessionId}/dial`, { method: 'POST' }),

  /**
   * A human agent completes a handed-off journey. The remaining fields are filled first with
   * captureField; `customerConfirmed` says the details were read back and confirmed.
   */
  submitHandoffJourney: (
    callSessionId: string,
    agentName: string,
    customerConfirmed: boolean,
    lifeSupportValidated = false,
  ) =>
    request<TurnResponse>(`/calls/${callSessionId}/handoff/submit`, {
      method: 'POST',
      body: JSON.stringify({
        agent_name: agentName,
        customer_confirmed: customerConfirmed,
        life_support_validated: lifeSupportValidated,
      }),
    }),

  /** Ring the human agent again on a live phone handoff (the customer is still on hold). */
  redialAgent: (callSessionId: string) =>
    request<TurnResponse>(`/calls/${callSessionId}/handoff/dial-agent`, { method: 'POST' }),

  getCall: (callSessionId: string) => request<CallSession>(`/calls/${callSessionId}`),
  getTranscript: (callSessionId: string) =>
    request<TranscriptSegment[]>(`/calls/${callSessionId}/transcript`),
  getHandoff: (callSessionId: string) => request<Handoff>(`/calls/${callSessionId}/handoff`),

  requestHandoff: (callSessionId: string, reason: HandoffReason = 'CUSTOMER_REQUEST', note?: string) =>
    request<TurnResponse>(`/calls/${callSessionId}/handoff`, {
      method: 'POST',
      body: JSON.stringify({ reason, note: note ?? null }),
    }),

  acceptHandoff: (callSessionId: string, acceptedBy: string) =>
    request<Handoff>(`/calls/${callSessionId}/handoff/accept`, {
      method: 'POST',
      body: JSON.stringify({ accepted_by: acceptedBy }),
    }),

  endCall: (callSessionId: string, reason = 'AGENT_ENDED') =>
    request<TurnResponse>(`/calls/${callSessionId}/end`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  /** Agent-Assisted mode: human captures or corrects one journey field live. */
  captureField: (
    callSessionId: string,
    fieldName: string,
    value: string,
    agentName = 'Human Agent',
  ) =>
    request<TurnResponse>(`/calls/${callSessionId}/field`, {
      method: 'POST',
      body: JSON.stringify({ field_name: fieldName, value, agent_name: agentName }),
    }),

  submitJourney: (payload: Record<string, string>) =>
    request<{ success: boolean; submission_id: string | null; status: string; errors: string[] }>(
      '/journey/submit',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  listSubmissions: () => request<Submission[]>('/journey/submissions'),

  dashboardSummary: () => request<DashboardSummary>('/dashboard/summary'),

  resetDemo: () => request<{ reset: boolean }>('/demo/reset', { method: 'POST' }),
}

/** Live session feed. Returns a disposer. */
export function openCallStream(
  callSessionId: string,
  onSession: (session: CallSession) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  let socket: WebSocket | null = null
  let closed = false

  try {
    socket = new WebSocket(`${WS_BASE_URL}/calls/${callSessionId}/stream`)
    socket.onopen = () => onStatus?.(true)
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload?.type === 'session' && payload.session) onSession(payload.session as CallSession)
      } catch {
        /* ignore malformed frames */
      }
    }
    socket.onclose = () => {
      onStatus?.(false)
      if (!closed) socket = null
    }
    socket.onerror = () => onStatus?.(false)
  } catch {
    onStatus?.(false)
  }

  return () => {
    closed = true
    socket?.close()
  }
}

/* ------------------------------------------------------------------ *
 * Presentation helpers
 * ------------------------------------------------------------------ */

export const FIELD_LABELS: Record<string, string> = {
  property_address: 'Service address',
  move_in_date: 'Move-in date',
  energy_requirement: 'Supply needed',
  contact_preference: 'Contact preference',
  concession_status: 'Concession',
  life_support: 'Life support',
  email: 'Email on file',
  phone: 'Phone on file',
}

export const VALUE_LABELS: Record<string, string> = {
  ELECTRICITY: 'Electricity',
  GAS: 'Gas',
  BOTH: 'Electricity + gas',
  YES: 'Yes',
  NO: 'No',
  UNSURE: 'Unsure',
  PHONE: 'Phone',
  EMAIL: 'Email',
}

export const HANDOFF_REASON_LABELS: Record<string, string> = {
  CUSTOMER_REQUEST: 'Customer asked for a person',
  FRUSTRATION: 'Customer frustrated',
  REPEATED_FAILURE: 'Field failed twice',
  SENSITIVE_TOPIC: 'Sensitive / vulnerable topic',
  OFF_SCRIPT: 'Off-script question',
  LOW_CONFIDENCE: 'Low confidence',
}

export const ESCALATION_LABELS: Record<string, string> = {
  ASKS: 'ASKS',
  ANGER: 'ANGER',
  CONFUSION: 'CONFUSION',
  SENSITIVE: 'SENSITIVE',
  'OFF-SCRIPT': 'OFF-SCRIPT',
  'LOW_CONF': 'LOW CONF',
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function formatValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  // Journey dates are stored ISO; show them the way a human would read them.
  if (ISO_DATE.test(value)) {
    const parsed = new Date(`${value}T00:00:00`)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })
    }
  }
  return VALUE_LABELS[value] ?? value
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Compact form for dense tables — drops the seconds and the year. */
export function formatShortDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  return `${String(minutes).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function fieldRows(session: CallSession): JourneyField[] {
  const order = [
    'property_address',
    'move_in_date',
    'energy_requirement',
    'concession_status',
    'life_support',
    'contact_preference',
  ]
  const byName = new Map(session.journey_fields.map((row) => [row.field_name, row]))
  return order.map(
    (name) =>
      byName.get(name) ?? {
        id: -1,
        field_name: name,
        value: null,
        status: 'PENDING' as const,
        source: 'CUSTOMER_SPOKEN' as const,
        confidence: null,
        attempts: 0,
      },
  )
}
