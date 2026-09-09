/**
 * Engine client error taxonomy.
 *
 * Shared by the server-side client (lib/engine/client.ts) and the
 * browser-side query fetchers (lib/engine/queries.ts) so UI code branches
 * on one set of classes regardless of which side of the /api/engine proxy
 * raised the error. This module is isomorphic — safe to import anywhere.
 */

/** The engine process is unreachable (connection refused, DNS, timeout). */
export class EngineOfflineError extends Error {
  readonly name = "EngineOfflineError"

  constructor(
    /** Where the caller tried to reach the engine (URL or proxy path). */
    readonly target: string,
    message?: string
  ) {
    super(message ?? `the automation engine is not reachable at ${target}`)
  }
}

/** The engine (or the proxy on its behalf) answered with a non-2xx status. */
export class EngineHttpError extends Error {
  readonly name = "EngineHttpError"

  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

/** A 2xx answer did not match the mirrored zod schema (contract drift). */
export class EngineValidationError extends Error {
  readonly name = "EngineValidationError"

  constructor(
    /** What was being parsed, e.g. "GET /capabilities". */
    readonly what: string,
    message?: string
  ) {
    super(message ?? `the engine returned an unexpected shape for ${what}`)
  }
}

export const isEngineOffline = (error: unknown): error is EngineOfflineError =>
  error instanceof EngineOfflineError

/** Any of the three engine error classes above. */
export const isEngineError = (
  error: unknown
): error is EngineOfflineError | EngineHttpError | EngineValidationError =>
  isEngineOffline(error) ||
  error instanceof EngineHttpError ||
  error instanceof EngineValidationError

/** Human-readable one-liner for any engine error, for banners and hints. */
export const engineErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
