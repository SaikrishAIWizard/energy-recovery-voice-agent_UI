import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Loader2,
  MinusCircle,
  PhoneOff,
  ShieldAlert,
  UserCheck,
} from 'lucide-react'
import type { LeadStatus, SessionStatus } from '../lib/types'

type Tone = 'done' | 'active' | 'blocked' | 'dnc' | 'neutral' | 'info'

const TONES: Record<Tone, { wrapper: string; dot: string }> = {
  done: {
    wrapper: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
    dot: 'bg-emerald-600',
  },
  active: {
    wrapper: 'bg-amber-50 text-amber-900 ring-amber-600/30',
    dot: 'bg-amber-500',
  },
  blocked: {
    wrapper: 'bg-red-50 text-red-800 ring-red-600/25',
    dot: 'bg-red-600',
  },
  dnc: {
    wrapper: 'bg-slate-100 text-slate-700 ring-slate-500/25',
    dot: 'bg-slate-500',
  },
  info: {
    wrapper: 'bg-blue-50 text-blue-800 ring-blue-600/25',
    dot: 'bg-blue-600',
  },
  neutral: {
    wrapper: 'bg-slate-100 text-slate-700 ring-slate-400/25',
    dot: 'bg-slate-400',
  },
}

const STATUS_MAP: Record<string, { tone: Tone; label: string; icon: typeof CheckCircle2; spin?: boolean }> = {
  ACTIVE: { tone: 'active', label: 'Call active', icon: Loader2, spin: true },
  COMPLETED: { tone: 'done', label: 'Journey completed', icon: CheckCircle2 },
  HANDOFF_REQUESTED: { tone: 'blocked', label: 'Human handoff', icon: UserCheck },
  DECLINED: { tone: 'blocked', label: 'Declined', icon: PhoneOff },
  INCOMPLETE: { tone: 'active', label: 'Recovery needed', icon: AlertTriangle },
  DNC_BLOCKED: { tone: 'dnc', label: 'DNC blocked', icon: Ban },
  DROPPED_OFF: { tone: 'neutral', label: 'Dropped off', icon: MinusCircle },
  IN_CALL: { tone: 'active', label: 'In call', icon: Loader2, spin: true },
  NOT_CALLED: { tone: 'neutral', label: 'Not called', icon: MinusCircle },
  SENSITIVE_TOPIC: { tone: 'blocked', label: 'Sensitive topic', icon: ShieldAlert },
  FRUSTRATION: { tone: 'blocked', label: 'Frustration', icon: AlertTriangle },
  OFF_SCRIPT: { tone: 'blocked', label: 'Off-script', icon: ShieldAlert },
  LOW_CONFIDENCE: { tone: 'blocked', label: 'Low confidence', icon: AlertTriangle },
  REPEATED_FAILURE: { tone: 'blocked', label: 'Repeated failure', icon: AlertTriangle },
  CUSTOMER_REQUEST: { tone: 'blocked', label: 'Customer request', icon: UserCheck },
}

export function StatusBadge({
  status,
  label,
  size = 'md',
}: {
  status: SessionStatus | LeadStatus | string
  label?: string
  size?: 'sm' | 'md'
}) {
  const entry = STATUS_MAP[status] ?? { tone: 'neutral' as Tone, label: status, icon: MinusCircle }
  const tone = TONES[entry.tone]
  const Icon = entry.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${tone.wrapper} ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${entry.spin ? 'animate-spin' : ''}`} aria-hidden />
      {label ?? entry.label}
    </span>
  )
}

export function DncBadge({ dnc }: { dnc: boolean }) {
  return dnc ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-500/25">
      <Ban className="h-3.5 w-3.5" aria-hidden />
      On DNC register
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/25">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
      DNC clear
    </span>
  )
}

export function SafetyFlag({ flag }: { flag: string }) {
  const danger = /CARD|SENSITIVE|LIFE_SUPPORT|VULNERABILITY|COMPLAINT|PROFANITY/.test(flag)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
        danger
          ? 'bg-red-50 text-red-700 ring-red-600/25'
          : 'bg-amber-50 text-amber-800 ring-amber-600/25'
      }`}
    >
      {flag.replace(/_/g, ' ')}
    </span>
  )
}
