import { useEffect, useRef, useState } from 'react'
import { Bot, Headset, ShieldCheck, User, Volume2 } from 'lucide-react'
import type { TranscriptSegment } from '../lib/types'
import { formatClock } from '../api/client'

const SPEAKER_META: Record<
  string,
  { label: string; align: string; bubble: string; icon: typeof Bot }
> = {
  AI_AGENT: {
    label: 'AI agent',
    align: 'items-start',
    bubble: 'bg-white border border-slate-200 text-slate-800',
    icon: Bot,
  },
  CUSTOMER: {
    label: 'Customer',
    align: 'items-end',
    bubble: 'bg-navy-800 text-white border border-navy-700',
    icon: User,
  },
  HUMAN_AGENT: {
    label: 'Human agent',
    align: 'items-start',
    bubble: 'bg-emerald-50 border border-emerald-200 text-emerald-950',
    icon: Headset,
  },
  UNKNOWN: {
    label: 'Unknown',
    align: 'items-start',
    bubble: 'bg-slate-100 border border-slate-200 text-slate-600',
    icon: User,
  },
}

export function TranscriptViewer({
  segments,
  onSpeak,
  emptyHint = 'No transcript yet. Start the call to begin the conversation.',
}: {
  segments: TranscriptSegment[]
  onSpeak?: (text: string) => void
  emptyHint?: string
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [segments.length, autoScroll])

  if (segments.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center px-6 text-center">
        <p className="max-w-xs text-sm text-slate-400">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div
      className="h-full overflow-y-auto px-4 py-3"
      onScroll={(event) => {
        const el = event.currentTarget
        setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 60)
      }}
    >
      <div className="space-y-3">
        {segments.map((segment) => {
          const meta = SPEAKER_META[segment.speaker] ?? SPEAKER_META.UNKNOWN
          const Icon = meta.icon
          const isCustomer = segment.speaker === 'CUSTOMER'
          return (
            <div key={segment.id} className={`flex flex-col gap-1 ${meta.align}`}>
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                <Icon className="h-3 w-3" aria-hidden />
                {meta.label}
                <span className="font-mono normal-case tracking-normal">
                  {formatClock(segment.start_seconds)}
                </span>
                {segment.redacted && (
                  <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 font-semibold text-red-700 ring-1 ring-inset ring-red-600/25">
                    <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                    redacted
                  </span>
                )}
                {segment.transcription_confidence !== null && isCustomer && (
                  <span className="font-mono normal-case tracking-normal text-slate-400">
                    {(segment.transcription_confidence * 100).toFixed(0)}% stt
                  </span>
                )}
              </div>
              <div
                className={`group relative max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed shadow-sm ${meta.bubble}`}
              >
                {segment.text}
                {segment.speaker === 'AI_AGENT' && onSpeak && (
                  <button
                    type="button"
                    onClick={() => onSpeak(segment.text)}
                    title="Replay this line"
                    className="absolute -right-2 -top-2 hidden rounded-full border border-slate-200 bg-white p-1 text-slate-500 shadow-sm hover:text-navy-800 group-hover:block"
                  >
                    <Volume2 className="h-3 w-3" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
    </div>
  )
}
