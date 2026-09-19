/* Shared API types — mirror the backend Pydantic schemas exactly. */

export type DatabaseValue = string | number | boolean | null
export type DatabaseRow = Record<string, DatabaseValue>

export interface DatabaseColumn {
  name: string
  type: string
  nullable: boolean
  primary_key: boolean
  references: string[]
}

export interface DatabaseTable {
  name: string
  row_count: number
  columns: DatabaseColumn[]
}

export interface DatabaseIndex {
  read_only: true
  tables: DatabaseTable[]
}

export interface DatabaseRows {
  table: string
  total: number
  matched: number
  limit: number
  offset: number
  sort_by: string
  direction: 'asc' | 'desc'
  rows: DatabaseRow[]
}

export type LeadStatus =
  | 'DROPPED_OFF'
  | 'IN_CALL'
  | 'COMPLETED'
  | 'DECLINED'
  | 'HANDOFF_REQUESTED'
  | 'DNC_BLOCKED'
  | 'NOT_CALLED'

export type SessionStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'DECLINED'
  | 'HANDOFF_REQUESTED'
  | 'DNC_BLOCKED'
  /** An uploaded recording was analysed and checklist items were missing. */
  | 'INCOMPLETE'

export type StepState = 'DONE' | 'ACTIVE' | 'PENDING' | 'SKIPPED' | 'FAILED'

export type Speaker = 'AI_AGENT' | 'CUSTOMER' | 'HUMAN_AGENT' | 'UNKNOWN'

export type HandoffReason =
  | 'CUSTOMER_REQUEST'
  | 'FRUSTRATION'
  | 'REPEATED_FAILURE'
  | 'SENSITIVE_TOPIC'
  | 'OFF_SCRIPT'
  | 'LOW_CONFIDENCE'

export interface Lead {
  id: string
  first_name: string
  last_name: string | null
  phone: string
  email: string
  last_completed_step: string
  dnc_status: boolean
  status: LeadStatus
  vertical: string
  created_at: string
}

export interface JourneyField {
  id: number
  field_name: string
  value: string | null
  status: 'PENDING' | 'VALID' | 'INVALID' | 'NOT_APPLICABLE'
  source: 'PREEXISTING' | 'CUSTOMER_SPOKEN' | 'HUMAN_AGENT'
  confidence: number | null
  attempts: number
}

export interface TranscriptSegment {
  id: number
  speaker: Speaker
  start_seconds: number
  end_seconds: number
  text: string
  transcription_confidence: number | null
  redacted: boolean
}

export interface AuditEvent {
  id: number
  event_type: string
  event_detail: string
  created_at: string
}

export interface StepProgress {
  step_id: string
  label: string
  status: StepState
}

export interface Handoff {
  id: number
  reason: HandoffReason
  current_step: string
  context_summary: string
  last_customer_message: string | null
  safety_flags: string[]
  collected_fields: Record<string, string | null>
  created_at: string
  accepted_by: string | null
  escalation_signal: string | null
  lead_id: string | null
  known_contact: Record<string, string | null>
  /** Required fields still missing, so the human knows what is left to collect. */
  outstanding_fields: string[]
  /** For each field heard: its value, status (a PENDING value was heard but never confirmed), confidence and source. */
  field_details: Record<
    string,
    { value: string | null; status: string; confidence: number | null; source: string }
  >
  recording_disclosed: boolean
}

export interface Submission {
  submission_id: string
  lead_id: string
  vertical: string
  status: string
  payload: Record<string, string>
  created_at: string
  call_session_id: string | null
}

export interface CallSession {
  id: string
  lead_id: string
  status: SessionStatus
  state: string
  current_step: string
  resume_step: string | null
  started_at: string
  ended_at: string | null
  recording_consent_disclosed: boolean
  handoff_reason: HandoffReason | null
  outcome_detail: string | null
  mode: string
  dial_provider: string | null
  telephony_reference: string | null
  lead: Lead
  journey_fields: JourneyField[]
  transcript: TranscriptSegment[]
  audit_events: AuditEvent[]
  handoff: Handoff | null
  submission: Submission | null
  journey_progress: StepProgress[]
  collected_fields: Record<string, string | null>
  known_fields: Record<string, string | null>
  missing_required_fields: string[]
  safety_flags: string[]
  last_agent_message: string | null
  last_customer_message: string | null
  demo_replies: string[]
}

export interface TurnResponse {
  session: CallSession
  agent_messages: string[]
  system_notes: string[]
  safety_flags: string[]
  handoff_triggered: boolean
  journey_submitted: boolean
  submission: Submission | null
  terminal: boolean
}

export interface SessionSummary {
  id: string
  status: SessionStatus
  mode: string
  dial_provider: string | null
  started_at: string
  ended_at: string | null
  outcome_detail: string | null
  handoff_reason: HandoffReason | null
  transcript_segments: number
  fields_captured: number
}

export interface HandoffListItem {
  session_id: string
  lead_id: string
  name: string
  reason: HandoffReason
  accepted_by: string | null
  created_at: string
  context_summary: string
}

export interface RecordingUploadResponse {
  session: CallSession
  outcome: 'COMPLETED' | 'INCOMPLETE' | 'DECLINED' | 'HANDOFF_REQUESTED'
  missing_fields: string[]
  stt_provider: string
  notes: string[]
}

export interface StartCallResponse {
  blocked: boolean
  blocked_reason: string | null
  session: CallSession | null
  agent_messages: string[]
  system_notes: string[]
}

export interface LeadQueueItem {
  lead: Lead
  resume_step: string
  scenario_notes: string | null
  expected_outcome: string | null
  latest_session_id: string | null
  latest_session_status: SessionStatus | null
  outcome_detail: string | null
  handoff_reason: HandoffReason | null
  started_at: string | null
  ended_at: string | null
  can_start: boolean
}

export interface LeadDetail {
  lead: Lead
  resume_step: string
  scenario_notes: string | null
  expected_outcome: string | null
  scripted_turns: Record<string, string>
  preexisting_fields: Record<string, string>
  field_prompts: Record<string, string>
  latest_session: CallSession | null
  dnc_check: { allowed?: boolean; code?: string; detail?: string }
}

export interface DashboardCounts {
  dropped_off: number
  active_calls: number
  completed: number
  handoffs: number
  declined: number
  dnc_blocked: number
}

export interface DashboardRow {
  lead_id: string
  name: string
  phone: string
  last_completed_step: string
  dnc_status: boolean
  call_status: SessionStatus | 'NOT_CALLED'
  call_session_id: string | null
  outcome_detail: string | null
  handoff_reason: HandoffReason | null
  started_at: string | null
  ended_at: string | null
}

export interface DashboardSummary {
  counts: DashboardCounts
  rows: DashboardRow[]
  completion_rate: number
  handoff_rate: number
  calls_placed: number
  fields_captured_automatically: number
  estimated_manual_minutes_saved: number
}

export interface HealthResponse {
  status: string
  app: string
  version: string
  leads: number
  call_sessions: number
  journey: {
    vertical: string
    journey_id: string
    script_version: string
    steps: number
    required_fields: string[]
  }
  capabilities: {
    core_demo_requires_api_keys: boolean
    /** Name of the backend/.env file that was loaded, or null if none was found. */
    env_file_loaded: string | null
    stt: {
      browser_web_speech: boolean
      simulated_turns: boolean
      server_upload_endpoint: boolean
      deepgram: boolean
      assemblyai: boolean
      openai_whisper: boolean
      active: string
    }
    tts: { browser_speech_synthesis: boolean; external_provider: boolean }
    llm_extraction: {
      rules_engine: boolean
      external_adapter: boolean
      provider: string
      model: string | null
      base_url: string | null
    }
    telephony: {
      browser_microphone: boolean
      twilio: boolean
      /** Twilio credentials AND PUBLIC_BASE_URL are set: the assistant can phone a customer. */
      live_calls: boolean
      public_base_url_set: boolean
      /** HANDOFF_TRANSFER_NUMBER is set: a handoff can dial a human into the same call. */
      handoff_agent_number_set: boolean
      /** TWILIO_DIAL_OVERRIDE_NUMBER is set: calls ring that number, not the lead's. */
      dial_override_active: boolean
      webhook_signature_validation: boolean
    }
  }
  voice_providers: {
    stt: Record<string, boolean>
    tts: Record<string, boolean>
    telephony: Record<string, boolean>
    /** Providers that can actually accept audio bytes, in preference order. */
    server_stt: string[]
    active: { stt: string; tts: string; telephony: string }
    requires_api_key_for_demo: boolean
  }
  llm: {
    active_adapter: string
    enabled: boolean
    note: string
    model?: string
    base_url?: string
  }
  guardrails: Record<string, unknown>
}
