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
  runId: string
  kind: string
  status: "pending" | "approved" | "rejected" | "resolved"
  reason: string
  /** Context payload JSON: current step, page state, screenshot path. */
  context: string
  createdAt: string
  resolvedAt: string | null
  /** One-time token issued on approval; replay checks its presence. */
  approvalToken: string | null
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
  runId TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  context TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  resolvedAt TEXT,
  approvalToken TEXT
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
  db.exec(SCHEMA)
  return db
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
  result: string
): void => {
  db.prepare(
    `UPDATE runs SET status = @status, finishedAt = @finishedAt, result = @result WHERE id = @id`
  ).run({ id, status, finishedAt: new Date().toISOString(), result })
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
    `INSERT INTO interventions (id, runId, kind, status, reason, context, createdAt, resolvedAt, approvalToken)
     VALUES (@id, @runId, @kind, @status, @reason, @context, @createdAt, @resolvedAt, @approvalToken)`
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
  approvalToken?: string
): void => {
  db.prepare(
    `UPDATE interventions SET status = @status, resolvedAt = @resolvedAt, approvalToken = @approvalToken WHERE id = @id`
  ).run({
    id,
    status,
    resolvedAt: new Date().toISOString(),
    approvalToken: approvalToken ?? null,
  })
}

/** Look up a valid (issued, unused) approval token for a run. */
export const findApprovalToken = (
  db: Database.Database,
  runId: string,
  token: string
): InterventionRow | undefined =>
  db
    .prepare(
      `SELECT * FROM interventions WHERE runId = @runId AND approvalToken = @token AND status = 'approved'`
    )
    .get({ runId, token }) as InterventionRow | undefined
