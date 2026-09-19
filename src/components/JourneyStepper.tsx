import { Check, ChevronRight, Circle, MinusCircle, XCircle } from 'lucide-react'
import type { StepProgress } from '../lib/types'

const STYLES: Record<
  StepProgress['status'],
  { ring: string; fill: string; text: string; label: string }
> = {
  DONE: {
    ring: 'ring-emerald-600',
    fill: 'bg-emerald-600 text-white',
    text: 'text-emerald-800',
    label: 'Done',
  },
  ACTIVE: {
    ring: 'ring-amber-500',
    fill: 'bg-amber-500 text-white',
    text: 'text-amber-900',
    label: 'Current',
  },
  FAILED: {
    ring: 'ring-red-600',
    fill: 'bg-red-600 text-white',
    text: 'text-red-800',
    label: 'Failed',
  },
  SKIPPED: {
    ring: 'ring-slate-300',
    fill: 'bg-slate-200 text-slate-500',
    text: 'text-slate-500',
    label: 'On file',
  },
  PENDING: {
    ring: 'ring-slate-300',
    fill: 'bg-white text-slate-400',
    text: 'text-slate-500',
    label: 'Pending',
  },
}

function StepIcon({ status }: { status: StepProgress['status'] }) {
  const cls = 'h-3 w-3'
  switch (status) {
    case 'DONE':
      return <Check className={cls} aria-hidden />
    case 'FAILED':
      return <XCircle className={cls} aria-hidden />
    case 'SKIPPED':
      return <MinusCircle className={cls} aria-hidden />
    case 'ACTIVE':
      return <ChevronRight className={cls} aria-hidden />
    default:
      return <Circle className={cls} aria-hidden />
  }
}

export function JourneyStepper({ steps }: { steps: StepProgress[] }) {
  const done = steps.filter((s) => s.status === 'DONE').length

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-navy-900">Journey progress</h3>
        <span className="text-xs text-slate-500">
          {done}/{steps.length} steps complete
        </span>
      </div>

      <ol className="space-y-0.5">
        {steps.map((step, index) => {
          const style = STYLES[step.status]
          const isLast = index === steps.length - 1
          return (
            <li key={step.step_id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ${style.ring} ${style.fill}`}
                >
                  <StepIcon status={step.status} />
                </span>
                {!isLast && (
                  <span
                    className={`my-0.5 w-px flex-1 ${
                      step.status === 'DONE' ? 'bg-emerald-300' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
              <div className={`pb-2.5 ${isLast ? 'pb-0' : ''}`}>
                <p
                  className={`text-sm leading-6 ${
                    step.status === 'ACTIVE' ? 'font-semibold' : 'font-medium'
                  } ${style.text}`}
                >
                  {step.label}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                  {step.step_id} · {style.label}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
