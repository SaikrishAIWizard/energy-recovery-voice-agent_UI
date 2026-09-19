import type { SessionStatus } from './types'

/** The page that best shows a call, given how it ended. */
export function sessionRoute(status: SessionStatus | string, sessionId: string): string {
  switch (status) {
    case 'HANDOFF_REQUESTED':
      return `/handoff/${sessionId}`
    case 'COMPLETED':
      return `/completed/${sessionId}`
    case 'INCOMPLETE':
      return `/recordings/${sessionId}` // sends a non-upload call on to its console
    default:
      return `/calls/${sessionId}`
  }
}
