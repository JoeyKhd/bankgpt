/**
 * Engine persistence (D-041): capabilities, runs, interventions, and run
 * evidence files (D-059) in the engine's own SQLite database, separate
 * from the frontend auth DB.
 *
 * One shared handle, WAL mode. Rows store validated JSON documents (the
 * capability artifact, the structured run result) as TEXT; run evidence
 * (step logs, transcripts, screenshots, snapshots) lives as BLOBs in
 * run_files. Querying happens on a few indexed columns only. This keeps
 * the schema small and the artifact schema (artifact.ts) the single
 * source of truth for shape.
 */
import Database from "better-sqlite3"
import { createHash } from "node:crypto"

import { redactText } from "@/policy"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

export type CapabilityRow = {
  id: string
  version: string
  name: string
  risk: string
  reviewed: number
  createdAt: string
  /** Full CapabilityArtifact JSON. */
  artifact: string
}

export type RunRow = {
  id: string
  kind: "discovery" | "replay"
  capabilityId: string | null
  status: string
  goal: string | null
  targetUrl: string | null
  startedAt: string
  finishedAt: string | null
  /** Structured run result JSON (RunResult), when finished. */
  result: string | null
}

/** One stored run-evidence file (steps.jsonl, result.json, screenshots…). */
export type RunFileRow = {
  runId: string
  name: string
  contentType: string
  data: Buffer
  createdAt: string
}

/** run_files listing entry: metadata only, size instead of the blob. */
export type RunFileInfo = {
  name: string
  contentType: string
  size: number
  createdAt: string
}

export type InterventionRow = {
  id: string
  /** Null until the run actually starts (approval requests create the run
   * row up front; engine fail-fast requests attach the failed run). */
  runId: string | null
  kind: string
  status: "pending" | "approved" | "rejected" | "resolved"
  reason: string
  /** Context payload JSON: capability/goal, inputs, step, page state. */
  context: string
  createdAt: string
  resolvedAt: string | null
  /** Identity (email) of the user/agent that raised the request. */
  requestedBy: string | null
  /** Identity (email) of the operator who decided. Null while pending. */
  decidedBy: string | null
  /** The operator's reason for the decision, when given. */
  decisionReason: string | null
  /**
   * One-time approval token issued on approval. Scoped: it authorizes
   * exactly ONE replay of the intervention's capability; the run that
   * consumed it is recorded in consumedByRunId.
   */
  approvalToken: string | null
  /** The run that consumed the approval token (single-use evidence). */
  consumedByRunId: string | null
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS capabilities (
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  risk TEXT NOT NULL,
  reviewed INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  artifact TEXT NOT NULL,
  PRIMARY KEY (id, version)
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  capabilityId TEXT,
  status TEXT NOT NULL,
  goal TEXT,
  targetUrl TEXT,
  startedAt TEXT NOT NULL,
  finishedAt TEXT,
  result TEXT
);
CREATE TABLE IF NOT EXISTS run_files (
  runId TEXT NOT NULL,
  name TEXT NOT NULL,
  contentType TEXT NOT NULL,
  data BLOB NOT NULL,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (runId, name)
);
CREATE TABLE IF NOT EXISTS interventions (
  id TEXT PRIMARY KEY,
  runId TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  context TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  resolvedAt TEXT,
  requestedBy TEXT,
  decidedBy TEXT,
  decisionReason TEXT,
  approvalToken TEXT,
  consumedByRunId TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_capability ON runs(capabilityId);
CREATE INDEX IF NOT EXISTS idx_interventions_status ON interventions(status);
`

/** Open (creating if needed) the shared engine database. */
export const openEngineDb = (dbPath: string): Database.Database => {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true })
  }
  const db = new Database(dbPath)
  db.pragma("journal_mode = WAL")
  migrateInterventions(db)
  migrateRuns(db)
  db.exec(SCHEMA)
  return db
}

/**
 * Run evidence moved from the filesystem into run_files (D-059), so the
 * runs table drops its evidenceDir column. CREATE TABLE IF NOT EXISTS
 * leaves old databases on the old shape, so rebuild the table when the
 * column is detected (same rebuild pattern as migrateInterventions). The
 * dead fs pointer is also removed from stored result JSON (json_remove
 * is a no-op where it is absent).
 */
const migrateRuns = (db: Database.Database): void => {
  const table = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'runs'`
    )
    .get()
  if (!table) return
  const columns = db.prepare(`PRAGMA table_info(runs)`).all() as Array<{
    name: string
  }>
  const names = new Set(columns.map((c) => c.name))
  if (!names.has("evidenceDir")) return
  db.exec(`
    BEGIN;
    CREATE TABLE runs_next (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      capabilityId TEXT,
      status TEXT NOT NULL,
      goal TEXT,
      targetUrl TEXT,
      startedAt TEXT NOT NULL,
      finishedAt TEXT,
      result TEXT
    );
    INSERT INTO runs_next
      (id, kind, capabilityId, status, goal, targetUrl, startedAt, finishedAt, result)
      SELECT id, kind, capabilityId, status, goal, targetUrl, startedAt, finishedAt,
        json_remove(result, '$.evidenceDir')
      FROM runs;
    DROP TABLE runs;
    ALTER TABLE runs_next RENAME TO runs;
    COMMIT;
  `)
}

/**
 * The interventions table grew identity + scoped-token columns (and a
 * nullable runId) when approval segregation landed. CREATE TABLE IF NOT
 * EXISTS leaves old databases on the old shape, so rebuild the table when
 * the old columns are detected (SQLite cannot ALTER COLUMN).
 */
const migrateInterventions = (db: Database.Database): void => {
  const table = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'interventions'`
    )
    .get()
  if (!table) return
  const columns = db
    .prepare(`PRAGMA table_info(interventions)`)
    .all() as Array<{ name: string }>
  const names = new Set(columns.map((c) => c.name))
  if (names.has("requestedBy") && names.has("consumedByRunId")) return
  db.exec(`
    BEGIN;
    CREATE TABLE interventions_next (
      id TEXT PRIMARY KEY,
      runId TEXT,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      context TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      resolvedAt TEXT,
      requestedBy TEXT,
      decidedBy TEXT,
      decisionReason TEXT,
      approvalToken TEXT,
      consumedByRunId TEXT
    );
    INSERT INTO interventions_next
      (id, runId, kind, status, reason, context, createdAt, resolvedAt, approvalToken)
      SELECT id, runId, kind, status, reason, context, createdAt, resolvedAt, approvalToken
      FROM interventions;
    DROP TABLE interventions;
    ALTER TABLE interventions_next RENAME TO interventions;
    COMMIT;
  `)
}

export const insertCapability = (
  db: Database.Database,
  row: CapabilityRow
): void => {
  db.prepare(
    `INSERT INTO capabilities (id, version, name, risk, reviewed, createdAt, artifact)
     VALUES (@id, @version, @name, @risk, @reviewed, @createdAt, @artifact)
     ON CONFLICT (id, version) DO UPDATE SET
       name = excluded.name, risk = excluded.risk,
       reviewed = excluded.reviewed, artifact = excluded.artifact`
  ).run(row)
  // A re-saved artifact that claims `reviewed: false` must not silently
  // strip the human review a previous version earned: keep the review true
  // if any stored version is reviewed — in BOTH the query column and the
  // embedded artifact flag (replay and the approvals gate read the artifact
  // JSON; the catalog reads the column).
  if (row.reviewed === 0) {
    const anyReviewed = db
      .prepare(
        `SELECT COUNT(*) AS n FROM capabilities WHERE id = @id AND reviewed = 1`
      )
      .get({ id: row.id }) as { n: number }
    if (anyReviewed.n > 0) {
      const artifact = JSON.parse(row.artifact) as Record<string, unknown>
      artifact.reviewed = true
      db.prepare(
        `UPDATE capabilities SET reviewed = 1, artifact = @artifact WHERE id = @id AND version = @version`
      ).run({
        id: row.id,
        version: row.version,
        artifact: JSON.stringify(artifact),
      })
    }
  }
}

export const getCapability = (
  db: Database.Database,
  id: string
): CapabilityRow | undefined =>
  db
    .prepare(
      `SELECT * FROM capabilities WHERE id = @id ORDER BY createdAt DESC LIMIT 1`
    )
    .get({ id }) as CapabilityRow | undefined

/** Fetch one exact stored version of a capability. */
export const getCapabilityVersion = (
  db: Database.Database,
  id: string,
  version: string
): CapabilityRow | undefined =>
  db
    .prepare(`SELECT * FROM capabilities WHERE id = @id AND version = @version`)
    .get({ id, version }) as CapabilityRow | undefined

/**
 * Stable content hash of a stored artifact row. Approvals pin this at
 * request time so the run that executes is provably the artifact the
 * operator reviewed, not whatever version is latest at approval time.
 */
export const hashCapabilityRow = (row: CapabilityRow): string =>
  createHash("sha256").update(row.artifact).digest("hex")

export const listCapabilities = (db: Database.Database): CapabilityRow[] =>
  db
    .prepare(`SELECT * FROM capabilities ORDER BY createdAt DESC`)
    .all() as CapabilityRow[]

export const setCapabilityReviewed = (
  db: Database.Database,
  id: string,
  reviewed: boolean
): void => {
  db.prepare(`UPDATE capabilities SET reviewed = @r WHERE id = @id`).run({
    r: reviewed ? 1 : 0,
    id,
  })
  // The artifact JSON is the authoritative contract replay parses — keep its
  // embedded review flag in sync with the query column, or a reviewed
  // capability still fails the artifact-level gate (and vice versa).
  const rows = db
    .prepare(`SELECT version, artifact FROM capabilities WHERE id = @id`)
    .all({ id }) as Array<{ version: string; artifact: string }>
  const update = db.prepare(
    `UPDATE capabilities SET artifact = @artifact WHERE id = @id AND version = @version`
  )
  for (const row of rows) {
    const artifact = JSON.parse(row.artifact) as Record<string, unknown>
    if (artifact.reviewed === reviewed) continue
    artifact.reviewed = reviewed
    update.run({ id, version: row.version, artifact: JSON.stringify(artifact) })
  }
}

export const insertRun = (db: Database.Database, row: RunRow): void => {
  // Redact at the persistence boundary: goals and target URLs are free text
  // that may carry credential-shaped substrings; the DB must never hold them raw.
  const safe = {
    ...row,
    goal: row.goal === null ? null : redactText(row.goal),
    targetUrl: row.targetUrl === null ? null : redactText(row.targetUrl),
  }
  db.prepare(
    `INSERT INTO runs (id, kind, capabilityId, status, goal, targetUrl, startedAt, finishedAt, result)
     VALUES (@id, @kind, @capabilityId, @status, @goal, @targetUrl, @startedAt, @finishedAt, @result)`
  ).run(safe)
}

/**
 * Store one run-evidence file (D-059). This is the raw persistence
 * boundary — a BLOB store like the filesystem it replaces — so producers
 * (the evidence writer, the handoff/result writers in server.ts) redact
 * text BEFORE calling; binary payloads (screenshots) are stored as-is.
 * Upserted on (runId, name): steps.jsonl is rewritten on every logged
 * step, and re-running a migration import must be idempotent.
 */
export const putRunFile = (
  db: Database.Database,
  runId: string,
  name: string,
  contentType: string,
  data: Buffer
): void => {
  db.prepare(
    `INSERT INTO run_files (runId, name, contentType, data, createdAt)
     VALUES (@runId, @name, @contentType, @data, @createdAt)
     ON CONFLICT (runId, name) DO UPDATE SET
       contentType = excluded.contentType,
       data = excluded.data,
       createdAt = excluded.createdAt`
  ).run({ runId, name, contentType, data, createdAt: new Date().toISOString() })
}

/** Fetch one stored run-evidence file (blob included). */
export const getRunFile = (
  db: Database.Database,
  runId: string,
  name: string
): RunFileRow | undefined =>
  db
    .prepare(`SELECT * FROM run_files WHERE runId = @runId AND name = @name`)
    .get({ runId, name }) as RunFileRow | undefined

/** List a run's stored evidence files (metadata + byte size, no blobs). */
export const listRunFiles = (
  db: Database.Database,
  runId: string
): RunFileInfo[] =>
  db
    .prepare(
      `SELECT name, contentType, length(data) AS size, createdAt
       FROM run_files WHERE runId = @runId ORDER BY name`
    )
    .all({ runId }) as RunFileInfo[]

/**
 * Read a run's step log back from the stored steps.jsonl blob (the
 * canonical step store) and parse it into one object per step. Empty when
 * the run has logged no steps.
 */
export const getRunSteps = (
  db: Database.Database,
  runId: string
): unknown[] => {
  const row = getRunFile(db, runId, "steps.jsonl")
  if (!row) return []
  return row.data
    .toString("utf8")
    .split("\n")
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line))
}

export const finishRun = (
  db: Database.Database,
  id: string,
  status: string,
  result: string | null
): void => {
  db.prepare(
    `UPDATE runs SET status = @status, finishedAt = @finishedAt, result = @result WHERE id = @id`
  ).run({
    id,
    status,
    finishedAt: new Date().toISOString(),
    // Redact the structured result before it persists — outputs/observed text
    // can carry secret/PII-shaped substrings from the page.
    result: result === null ? null : redactText(result),
  })
}

/** Flip a run's lifecycle status without finishing it (e.g. an
 * "awaiting_approval" run that starts executing once approved). */
export const setRunStatus = (
  db: Database.Database,
  id: string,
  status: string
): void => {
  db.prepare(`UPDATE runs SET status = @status WHERE id = @id`).run({
    id,
    status,
  })
}

export const getRun = (db: Database.Database, id: string): RunRow | undefined =>
  db.prepare(`SELECT * FROM runs WHERE id = @id`).get({ id }) as
    RunRow | undefined

export const listRuns = (db: Database.Database): RunRow[] =>
  db.prepare(`SELECT * FROM runs ORDER BY startedAt DESC`).all() as RunRow[]

export const insertIntervention = (
  db: Database.Database,
  row: InterventionRow
): void => {
  // Redact at the persistence boundary: context carries capability inputs
  // and page state (member ids, typed values); reason is free text.
  // approvalToken must stay exact-matchable (verified by
  // findInterventionByToken) — it is single-use, short-lived, and masked by
  // redactValue in every response/evidence path instead.
  const safe = {
    ...row,
    reason: redactText(row.reason),
    context: redactText(row.context),
  }
  db.prepare(
    `INSERT INTO interventions (id, runId, kind, status, reason, context, createdAt, resolvedAt, requestedBy, decidedBy, decisionReason, approvalToken, consumedByRunId)
     VALUES (@id, @runId, @kind, @status, @reason, @context, @createdAt, @resolvedAt, @requestedBy, @decidedBy, @decisionReason, @approvalToken, @consumedByRunId)`
  ).run(safe)
}

export const getIntervention = (
  db: Database.Database,
  id: string
): InterventionRow | undefined =>
  db.prepare(`SELECT * FROM interventions WHERE id = @id`).get({ id }) as
    InterventionRow | undefined

export const listInterventions = (
  db: Database.Database,
  status?: string
): InterventionRow[] =>
  status
    ? (db
        .prepare(
          `SELECT * FROM interventions WHERE status = @status ORDER BY createdAt DESC`
        )
        .all({ status }) as InterventionRow[])
    : (db
        .prepare(`SELECT * FROM interventions ORDER BY createdAt DESC`)
        .all() as InterventionRow[])

export const resolveIntervention = (
  db: Database.Database,
  id: string,
  status: "approved" | "rejected" | "resolved",
  decision?: {
    decidedBy?: string
    decisionReason?: string
    approvalToken?: string
  }
): void => {
  db.prepare(
    `UPDATE interventions SET status = @status, resolvedAt = @resolvedAt, decidedBy = @decidedBy, decisionReason = @decisionReason, approvalToken = @approvalToken WHERE id = @id`
  ).run({
    id,
    status,
    resolvedAt: new Date().toISOString(),
    decidedBy: decision?.decidedBy ?? null,
    decisionReason: decision?.decisionReason
      ? redactText(decision.decisionReason)
      : null,
    approvalToken: decision?.approvalToken ?? null,
  })
}

/** Link a run to an intervention (request-first approvals start the run on
 * approval; the runId is then recorded back onto the intervention). */
export const setInterventionRunId = (
  db: Database.Database,
  id: string,
  runId: string
): void => {
  db.prepare(`UPDATE interventions SET runId = @runId WHERE id = @id`).run({
    id,
    runId,
  })
}

/** Merge extra fields into an intervention's context JSON payload. */
export const mergeInterventionContext = (
  db: Database.Database,
  id: string,
  patch: Record<string, unknown>
): void => {
  const row = getIntervention(db, id)
  if (!row) return
  let context: Record<string, unknown> = {}
  try {
    context = JSON.parse(row.context) as Record<string, unknown>
  } catch {
    // A malformed context is replaced rather than crashing the update.
  }
  db.prepare(`UPDATE interventions SET context = @context WHERE id = @id`).run({
    id,
    context: JSON.stringify({ ...context, ...patch }),
  })
}

/** Look up an intervention by its issued approval token. */
export const findInterventionByToken = (
  db: Database.Database,
  token: string
): InterventionRow | undefined =>
  db
    .prepare(`SELECT * FROM interventions WHERE approvalToken = @token`)
    .get({ token }) as InterventionRow | undefined

/**
 * Record the run that consumed a (single-use) approval token. The UPDATE
 * is conditional — it only lands while the token is still unconsumed — so
 * two runs racing the same token cannot both be marked as its consumer:
 * exactly one `changes` count is 1. Returns true for the run that won.
 */
export const consumeApprovalToken = (
  db: Database.Database,
  id: string,
  runId: string
): boolean =>
  db
    .prepare(
      `UPDATE interventions SET consumedByRunId = @runId
       WHERE id = @id AND consumedByRunId IS NULL`
    )
    .run({ id, runId }).changes === 1
