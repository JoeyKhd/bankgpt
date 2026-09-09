/**
 * Engine persistence (D-041): capabilities, runs, and interventions in the
 * engine's own SQLite database, separate from the frontend auth DB.
 *
 * One shared handle, WAL mode. Rows store validated JSON documents (the
 * capability artifact, the structured run result) as TEXT; querying happens
 * on a few indexed columns only. This keeps the schema small and the
 * artifact schema (artifact.ts) the single source of truth for shape.
 */
import Database from "better-sqlite3"
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
  /** Directory holding steps.jsonl / transcript / screenshots. */
  evidenceDir: string | null
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
  result TEXT,
  evidenceDir TEXT
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
  db.exec(SCHEMA)
  return db
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
}

export const insertRun = (db: Database.Database, row: RunRow): void => {
  db.prepare(
    `INSERT INTO runs (id, kind, capabilityId, status, goal, targetUrl, startedAt, finishedAt, result, evidenceDir)
     VALUES (@id, @kind, @capabilityId, @status, @goal, @targetUrl, @startedAt, @finishedAt, @result, @evidenceDir)`
  ).run(row)
}

export const finishRun = (
  db: Database.Database,
  id: string,
  status: string,
  result: string | null
): void => {
  db.prepare(
    `UPDATE runs SET status = @status, finishedAt = @finishedAt, result = @result WHERE id = @id`
  ).run({ id, status, finishedAt: new Date().toISOString(), result })
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
  db.prepare(
    `INSERT INTO interventions (id, runId, kind, status, reason, context, createdAt, resolvedAt, requestedBy, decidedBy, decisionReason, approvalToken, consumedByRunId)
     VALUES (@id, @runId, @kind, @status, @reason, @context, @createdAt, @resolvedAt, @requestedBy, @decidedBy, @decisionReason, @approvalToken, @consumedByRunId)`
  ).run(row)
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
    decisionReason: decision?.decisionReason ?? null,
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

/** Record the run that consumed a (single-use) approval token. */
export const consumeApprovalToken = (
  db: Database.Database,
  id: string,
  runId: string
): void => {
  db.prepare(
    `UPDATE interventions SET consumedByRunId = @runId WHERE id = @id`
  ).run({ id, runId })
}
