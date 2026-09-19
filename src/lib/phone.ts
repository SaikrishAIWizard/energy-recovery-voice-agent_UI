import type { CallSession } from './types'

/** The assistant is on a real phone call with the customer right now. */
export function isLivePhoneCall(session: CallSession): boolean {
  return (
    session.dial_provider === 'twilio' &&
    Boolean(session.telephony_reference) &&
    // CLOSING: the journey is submitted but the agent is still asking "anything else?".
    (session.status === 'ACTIVE' || session.state === 'CLOSING')
  )
}

export type PhoneTone = 'progress' | 'good' | 'problem'

export interface PhoneStatus {
  label: string
  tone: PhoneTone
  /** The audit event's own text — e.g. Twilio's reason for refusing a call. */
  detail?: string
}

const CALL_EVENTS: Record<string, PhoneStatus> = {
  PHONE_CALL_PLACED: { label: 'Calling the customer…', tone: 'progress' },
  PHONE_CALL_RINGING: { label: 'Phone is ringing…', tone: 'progress' },
  PHONE_CALL_ANSWERED: { label: 'Customer is on the line', tone: 'good' },
  PHONE_CALL_UNANSWERED: { label: 'No answer — try again', tone: 'problem' },
  PHONE_CALL_FAILED: { label: 'The call could not be placed', tone: 'problem' },
  PHONE_CALL_ENDED: { label: 'Phone call ended', tone: 'progress' },
}

const HANDOFF_EVENTS: Record<string, PhoneStatus> = {
  HANDOFF_AGENT_DIALLED: { label: 'Ringing the human agent…', tone: 'progress' },
  HANDOFF_AGENT_ANSWERED: { label: 'Agent picked up and is being briefed', tone: 'progress' },
  HANDOFF_AGENT_ACCEPTED: { label: 'Agent is joining the call…', tone: 'progress' },
  HANDOFF_AGENT_JOINED: { label: 'Human agent is on the same call', tone: 'good' },
  HANDOFF_AGENT_UNAVAILABLE: {
    label: 'Agent busy or not answering — customer is on hold, ringing again',
    tone: 'progress',
  },
  HANDOFF_HOLD_NOTICE: { label: 'Customer told to hold — ringing the agent again', tone: 'progress' },
  HANDOFF_AGENT_DECLINED: { label: 'The agent declined the call', tone: 'problem' },
  HANDOFF_AGENT_FAILED: { label: 'Twilio could not call the agent', tone: 'problem' },
  HANDOFF_AGENT_UNCONFIGURED: { label: 'No agent phone is configured', tone: 'problem' },
  HANDOFF_AGENT_NEVER_JOINED: { label: 'No agent joined — the customer was promised a callback', tone: 'problem' },
  HANDOFF_CONFERENCE_ENDED: { label: 'Handoff call ended', tone: 'progress' },
}

function latest(session: CallSession, table: Record<string, PhoneStatus>): PhoneStatus | null {
  for (let i = session.audit_events.length - 1; i >= 0; i -= 1) {
    const event = session.audit_events[i]
    const hit = table[event.event_type]
    if (hit) return { ...hit, detail: event.event_detail || undefined }
  }
  return null
}

/** Where the customer's phone call stands, read from the audit trail. */
export function customerCallStatus(session: CallSession): PhoneStatus | null {
  return latest(session, CALL_EVENTS)
}

/** Where the human agent's side of a phone handoff stands. */
export function handoffAgentStatus(session: CallSession): PhoneStatus | null {
  return latest(session, HANDOFF_EVENTS)
}

/** Whether a handoff is happening on a real phone call (so an agent can be added to it). */
export function isPhoneHandoff(session: CallSession): boolean {
  return session.status === 'HANDOFF_REQUESTED' && session.dial_provider === 'twilio'
}
