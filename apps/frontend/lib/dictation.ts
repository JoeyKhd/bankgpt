"use client"

import {
  WebSpeechDictationAdapter,
  type DictationAdapter,
} from "@assistant-ui/react"

const FALLBACK_MESSAGE = "Voice input failed. Please try again."
const START_FAILED_MESSAGE = "Voice input couldn't start. Please try again."
const UNSUPPORTED_MESSAGE =
  "Voice input isn't supported in this browser. Try Chrome, Edge, or Safari."

// Native SpeechRecognition error codes mapped to user-facing text. The
// "network" code is what Chrome raises when its server-side speech service
// can't be reached, which is by far the most common failure in practice.
const ERROR_MESSAGES: Record<string, string> = {
  network:
    "Voice input is unavailable. Chrome's speech recognition needs to reach Google's servers, which failed — check your connection, or try Edge/Safari.",
  "not-allowed":
    "Microphone access was denied. Allow the microphone in your browser's site settings and try again.",
  "service-not-allowed":
    "This browser doesn't allow its speech recognition service on this page.",
  "audio-capture":
    "No microphone was found. Connect a microphone and try again.",
  "no-speech": "No speech was detected. Try again and speak clearly.",
  "language-not-supported":
    "Voice input doesn't support your current language setting.",
  aborted: "Voice input was interrupted.",
  unsupported: UNSUPPORTED_MESSAGE,
  "start-failed": START_FAILED_MESSAGE,
}

export const isDictationSupported = () =>
  WebSpeechDictationAdapter.isSupported()

type DictationErrorHandler = (message: string) => void

let notifyError: DictationErrorHandler | null = null

// The thread's UI subscribes on mount. Kept module-level because the
// dictation adapter is created inside the runtime hook, which has no access
// to React state.
export const subscribeDictationErrors = (handler: DictationErrorHandler) => {
  notifyError = handler
  return () => {
    if (notifyError === handler) notifyError = null
  }
}

const reportDictationError = (code: string) => {
  notifyError?.(ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE)
}

let consolePatched = false

// The underlying adapter reports recognition failures ASYNCHRONOUSLY: its
// SpeechRecognition "error" event fires while a session is active, after
// listen() has already returned, and it reports via
// console.error("Dictation error:", code, message). Intercepting that one
// call only for the duration of listen() (the previous behavior) missed
// every real failure — so the interceptor is installed once and stays in
// place for the app's lifetime. Every non-dictation call passes through
// untouched.
const patchConsoleError = () => {
  if (consolePatched) return
  consolePatched = true
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    if (args[0] === "Dictation error:") {
      reportDictationError(String(args[1] ?? ""))
    }
    originalError.apply(console, args)
  }
}

// Wraps the Web Speech adapter so failures reach the user instead of only
// hitting the console.
class ReportingDictationAdapter implements DictationAdapter {
  private inner = new WebSpeechDictationAdapter()

  listen(): DictationAdapter.Session {
    patchConsoleError()
    try {
      return this.inner.listen()
    } catch (error) {
      // Thrown synchronously, e.g. SpeechRecognition missing despite the
      // support check, or the browser refusing to start.
      reportDictationError(
        error instanceof Error && error.message.includes("not supported")
          ? "unsupported"
          : "start-failed"
      )
      return failedSession()
    }
  }
}

const failedSession = (): DictationAdapter.Session => ({
  status: { type: "ended", reason: "error" },
  stop: () => Promise.resolve(),
  cancel: () => {},
  onSpeechStart: () => () => {},
  onSpeechEnd: () => () => {},
  onSpeech: () => () => {},
})

// Only expose the adapter when the browser actually implements the API, so
// the runtime's dictation capability (and thus the mic button) stays off
// where clicking it could never work.
export const createDictationAdapter = (): DictationAdapter | undefined =>
  isDictationSupported() ? new ReportingDictationAdapter() : undefined

export { UNSUPPORTED_MESSAGE }
