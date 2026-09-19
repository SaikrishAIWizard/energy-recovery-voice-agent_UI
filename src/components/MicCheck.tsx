import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Mic, RefreshCw, X } from 'lucide-react'

/**
 * Microphone diagnostic.
 *
 * `webkitSpeechRecognition` gives almost no feedback about *why* it failed. A device that
 * is muted, a device that is not the one you are speaking into, and a device another app
 * has grabbed all surface as the same `no-speech` error. This panel answers the one
 * question that actually separates those cases — is audio reaching the browser at all —
 * by opening the same input device the recogniser would use and drawing its level.
 *
 * It deliberately cannot *pick* a device: Chrome's SpeechRecognition has no device
 * selection API and always uses the system default. So the useful output is the *name* of
 * that default, which is what you need in order to go and change it in Windows.
 */

interface MicCheckProps {
  onClose: () => void
}

type Phase = 'live' | 'error'

/** Copy for the recognition error codes, so the console never shows a bare error code. */
export const SPEECH_ERROR_HELP: Record<string, string> = {
  'no-speech':
    'No speech detected — the microphone opened but stayed silent. Run the mic check to see whether any audio is reaching the browser.',
  'audio-capture':
    'No microphone available. The browser could not open an input device at all.',
  'not-allowed':
    'Microphone permission is blocked. Allow it in the address bar, then reload.',
  'service-not-allowed':
    'The browser refused its speech service. Chrome and Edge provide one; Brave and some Chromium builds do not.',
  network:
    'The browser could not reach its speech service. Chrome transcribes in the cloud, so this needs working internet.',
  'language-not-supported':
    'Australian English (en-AU) is not available in this browser speech service.',
  'bad-grammar': 'The browser rejected the speech grammar. Typed turns work identically.',
  aborted: '',
}

function browserName(): string {
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return 'Microsoft Edge'
  if (/OPR\//.test(ua)) return 'Opera'
  if ((navigator as { brave?: unknown }).brave) return 'Brave'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  return 'this browser'
}

function describeGetUserMediaError(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone permission was blocked. Allow it in the address bar, then try again.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone was found. Plug one in, then try again.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The microphone is already in use by another application, or blocked by a privacy setting. Close Zoom, Teams or Discord and try again.'
    case 'OverconstrainedError':
      return 'The selected microphone is unavailable.'
    default:
      return `Could not open the microphone${name ? ` (${name})` : ''}.`
  }
}

export function MicCheck({ onClose }: MicCheckProps) {
  const [nonce, setNonce] = useState(0)
  const [phase, setPhase] = useState<Phase>('live')
  const [deviceLabel, setDeviceLabel] = useState('')
  const [level, setLevel] = useState(0)
  const [peak, setPeak] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [heard, setHeard] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let context: AudioContext | null = null
    let timer: number | undefined
    let cancelled = false

    setPhase('live')
    setError(null)
    setHeard(false)
    setPeak(0)

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase('error')
        setError(
          'This browser exposes no microphone API. Typed and scripted turns drive the same state machine, so the demo is unaffected.',
        )
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        const track = stream.getAudioTracks()[0]
        setDeviceLabel(track?.label || 'Default input device')

        context = new AudioContext()
        // A suspended context feeds the analyser pure silence, which would render a flat
        // bar for a perfectly healthy microphone — the exact false negative this panel
        // exists to rule out. Resume defensively; the panel can auto-open on `no-speech`,
        // which is not a user gesture.
        if (context.state === 'suspended') void context.resume()
        const analyser = context.createAnalyser()
        analyser.fftSize = 1024
        context.createMediaStreamSource(stream).connect(analyser)
        const buffer = new Uint8Array(analyser.fftSize)

        timer = window.setInterval(() => {
          analyser.getByteTimeDomainData(buffer)
          let sum = 0
          for (let index = 0; index < buffer.length; index += 1) {
            const sample = (buffer[index] - 128) / 128
            sum += sample * sample
          }
          const rms = Math.sqrt(sum / buffer.length)
          const percent = Math.min(100, Math.round(rms * 300))
          setLevel(percent)
          setPeak((previous) => Math.max(previous * 0.92, percent))
          if (percent > 6) setHeard(true)
        }, 60)
      } catch (err) {
        if (cancelled) return
        setPhase('error')
        setError(describeGetUserMediaError(err))
      }
    }

    void start()

    return () => {
      cancelled = true
      if (timer !== undefined) window.clearInterval(timer)
      stream?.getTracks().forEach((track) => track.stop())
      void context?.close()
    }
  }, [nonce])

  const retry = useCallback(() => setNonce((value) => value + 1), [])

  const speechApiPresent =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  const browser = typeof navigator === 'undefined' ? 'this browser' : browserName()

  return (
    <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          <Mic className="h-3.5 w-3.5" aria-hidden />
          Microphone check
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          aria-label="Close microphone check"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {phase === 'error' ? (
        <div className="space-y-2">
          <p className="flex items-start gap-1.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-navy-300 hover:text-navy-900"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-xs text-slate-600">
            Windows is feeding <span className="font-medium text-navy-900">{deviceLabel || 'opening…'}</span> to the
            browser. Chrome&apos;s speech recognition always uses this system default — it
            cannot be told to use a different one from the page.
          </p>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Input level</span>
              <span className="font-mono">{level}%</span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-[width] duration-75 ${
                  heard ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
                style={{ width: `${level}%` }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-navy-500/70"
                style={{ left: `calc(${peak}% - 1px)` }}
                aria-hidden
              />
            </div>
          </div>

          {heard ? (
            <p className="flex items-start gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Audio is reaching the browser. If recognition still says <code>no-speech</code>, the
              device is fine and the problem is upstream — see the notes below.
            </p>
          ) : (
            <p className="flex items-start gap-1.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              No signal yet. Say something at normal volume — if the bar stays flat, the browser
              is receiving silence and no recogniser can help.
            </p>
          )}

          <div className="space-y-1 border-t border-slate-200 pt-2 text-[11px] leading-relaxed text-slate-500">
            <p>
              <span className="font-medium text-slate-600">If the bar stays flat:</span> open{' '}
              <span className="font-mono">Windows Settings &rarr; System &rarr; Sound &rarr; Input</span>,
              set the right device as default, and watch its level meter there. A headset mute
              switch or a disconnected Bluetooth device is the usual culprit.
            </p>
            <p>
              <span className="font-medium text-slate-600">If the bar moves but recognition fails:</span>{' '}
              Chrome and Edge transcribe in the cloud, so check internet access. Brave and some
              Chromium builds ship without the service at all.
            </p>
            <p>
              <span className="font-medium text-slate-600">Environment:</span> {browser} ·{' '}
              {speechApiPresent ? 'speech API present' : 'no speech API'} ·{' '}
              {window.isSecureContext ? 'secure context' : 'insecure context (needs localhost or HTTPS)'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
