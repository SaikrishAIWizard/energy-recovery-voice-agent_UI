import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  Ban,
  Check,
  Keyboard,
  Mic,
  MicOff,
  Play,
  Send,
  Sparkles,
  Square,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react'

import { MicCheck, SPEECH_ERROR_HELP } from './MicCheck'

export type UtteranceSource = 'BROWSER_SPEECH' | 'SIMULATED' | 'HUMAN_TYPED'

/* ------------------------------------------------------------------ *
 * Speech helpers (browser-native — no API key, no cost)
 * ------------------------------------------------------------------ */

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speakText(text: string, enabled = true): void {
  if (!enabled || !ttsSupported() || !text) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-AU'
    utterance.rate = 1.02
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  } catch {
    /* TTS is a nicety, never a blocker */
  }
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel()
}

function sttSupported(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

interface VoiceControlsProps {
  disabled: boolean
  /** Shown in the disabled text box. Defaults to "Call has ended". */
  disabledHint?: string
  demoReplies: string[]
  scriptedTurn: string | null
  onSubmit: (text: string, source: UtteranceSource) => void
  onPlayScript: () => void
  playing: boolean
  autoSpeak: boolean
  onAutoSpeakChange: (value: boolean) => void
  assistedMode: boolean
  onAssistedModeChange: (value: boolean) => void
  pendingDraft: string | null
  onApproveDraft: () => void
  /** Server-side STT providers the backend can actually reach, from /health. */
  serverStt?: string[]
  /** Posts raw audio for server-side transcription. Absent -> no upload offered. */
  onSubmitAudio?: (file: File) => Promise<void>
}

export function VoiceControls({
  disabled,
  disabledHint = 'Call has ended',
  demoReplies,
  scriptedTurn,
  onSubmit,
  onPlayScript,
  playing,
  autoSpeak,
  onAutoSpeakChange,
  assistedMode,
  onAssistedModeChange,
  pendingDraft,
  onApproveDraft,
  serverStt = [],
  onSubmitAudio,
}: VoiceControlsProps) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [audioBusy, setAudioBusy] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [micCheckOpen, setMicCheckOpen] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const canUpload = Boolean(onSubmitAudio) && serverStt.length > 0

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      stopSpeaking()
    }
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const startListening = useCallback(() => {
    if (!sttSupported()) {
      setSpeechError('This browser has no Web Speech API. Use typed or scripted turns instead.')
      return
    }
    setSpeechError(null)
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) return

    const recognition = new Ctor()
    recognition.lang = 'en-AU'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => setListening(true)
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex]
      const transcript = result?.[0]?.transcript ?? ''
      if (result?.isFinal && transcript.trim()) {
        onSubmit(transcript.trim(), 'BROWSER_SPEECH')
        setText('')
      } else {
        setText(transcript)
      }
    }
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const help = SPEECH_ERROR_HELP[event.error]
      // An empty entry means "expected, not worth showing" — `aborted` is the user
      // stopping the mic, not a failure.
      setSpeechError(help ?? `Speech recognition failed (${event.error}).`)
      setListening(false)
      // A silent or unopenable device is the one failure a message cannot diagnose, so
      // open the meter that shows whether audio is reaching the browser at all.
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        setMicCheckOpen(true)
      }
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
  }, [onSubmit])

  const submitTyped = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed, 'HUMAN_TYPED')
    setText('')
    inputRef.current?.focus()
  }, [disabled, onSubmit, text])

  const submitAudio = useCallback(
    async (file: File) => {
      if (!onSubmitAudio || disabled) return
      setAudioError(null)
      setAudioBusy(true)
      try {
        await onSubmitAudio(file)
      } catch (error) {
        setAudioError(error instanceof Error ? error.message : 'Transcription failed.')
      } finally {
        setAudioBusy(false)
        // Reset so picking the same file twice still fires onChange.
        if (fileRef.current) fileRef.current.value = ''
      }
    },
    [disabled, onSubmitAudio],
  )

  return (
    <div className="space-y-3">
      {/* Mode controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => onAssistedModeChange(false)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              !assistedMode ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-700'
            }`}
          >
            Agent-driven
          </button>
          <button
            type="button"
            onClick={() => onAssistedModeChange(true)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              assistedMode ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-700'
            }`}
          >
            Agent-assisted
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (autoSpeak) stopSpeaking()
            onAutoSpeakChange(!autoSpeak)
          }}
          disabled={!ttsSupported()}
          title={ttsSupported() ? 'Toggle spoken agent replies' : 'Speech synthesis unavailable'}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-navy-900 disabled:opacity-40"
        >
          {autoSpeak ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          {autoSpeak ? 'Voice on' : 'Voice off'}
        </button>
      </div>

      {/* Agent-assisted approval gate */}
      {assistedMode && pendingDraft && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Drafted line awaiting approval
          </p>
          <p className="mb-2 text-sm text-amber-950">{pendingDraft}</p>
          <button
            type="button"
            onClick={onApproveDraft}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Approve &amp; speak
          </button>
        </div>
      )}

      {/* Quick replies */}
      {demoReplies.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Simulated customer replies
          </p>
          <div className="flex flex-wrap gap-1.5">
            {demoReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                disabled={disabled}
                onClick={() => onSubmit(reply, 'SIMULATED')}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:border-navy-300 hover:bg-navy-50 hover:text-navy-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Typed turn */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Keyboard
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            ref={inputRef}
            value={text}
            disabled={disabled}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitTyped()
            }}
            placeholder={disabled ? disabledHint : 'Type what the customer says…'}
            className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-navy-400 focus:outline-none focus:ring-1 focus:ring-navy-400 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        <button
          type="button"
          disabled={disabled || !text.trim()}
          onClick={submitTyped}
          className="inline-flex items-center gap-1.5 rounded-md bg-navy-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          Send
        </button>
      </div>

      {/* Microphone + scripted playback */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={listening ? stopListening : startListening}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
            listening
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'border border-slate-200 bg-white text-slate-700 hover:border-navy-300 hover:text-navy-900'
          }`}
        >
          {listening ? (
            <>
              <MicOff className="h-3.5 w-3.5" aria-hidden />
              Stop listening
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5" aria-hidden />
              Hold a turn (mic)
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMicCheckOpen((open) => !open)}
          title="Show which microphone Windows is feeding to the browser, and whether any audio is arriving"
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition ${
            micCheckOpen
              ? 'border-navy-300 bg-navy-50 text-navy-900'
              : 'border-slate-200 bg-white text-slate-700 hover:border-navy-300 hover:text-navy-900'
          }`}
        >
          <Activity className="h-3.5 w-3.5" aria-hidden />
          Mic check
        </button>

        <button
          type="button"
          disabled={disabled || playing}
          onClick={onPlayScript}
          title={
            scriptedTurn
              ? `Plays this lead's scripted replies step by step`
              : 'No scripted replies for this lead'
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-navy-300 hover:text-navy-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? (
            <>
              <Square className="h-3.5 w-3.5" aria-hidden />
              Playing script…
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" aria-hidden />
              Run scripted call
            </>
          )}
        </button>

        {canUpload && (
          <>
            <button
              type="button"
              disabled={disabled || audioBusy}
              onClick={() => fileRef.current?.click()}
              title={`Transcribes server-side via ${serverStt.join(', ')}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-navy-300 hover:text-navy-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              {audioBusy ? 'Transcribing…' : 'Transcribe audio file'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void submitAudio(file)
              }}
            />
          </>
        )}
      </div>

      {micCheckOpen && <MicCheck onClose={() => setMicCheckOpen(false)} />}

      {!sttSupported() && (
        <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
          <Ban className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Web Speech API unavailable in this browser.{' '}
          {canUpload
            ? 'Use "Transcribe audio file" for server-side speech-to-text, or typed and scripted turns.'
            : 'Typed and scripted turns drive the same state machine, so the demo is unaffected.'}
        </p>
      )}
      {speechError && <p className="text-[11px] text-amber-700">{speechError}</p>}
      {audioError && <p className="text-[11px] text-amber-700">{audioError}</p>}
    </div>
  )
}
