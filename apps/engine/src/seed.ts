/**
 * Capability seeding (D-068).
 *
 * A fresh environment (new dev checkout, a new compose volume) should not
 * have to run an LLM discovery before the demo works: the two canonical
 * mockbank capabilities are committed as reviewed artifacts under
 * `seeds/` and inserted on first boot. Seeding only fills capabilities
 * that are entirely ABSENT — it never overwrites an existing capability,
 * so a review pass or a fresh discovery in that environment is preserved.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { CapabilityArtifactSchema } from "@/artifact"
import { getCapability, insertCapability } from "@/db"
import type Database from "better-sqlite3"

const SEEDS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "seeds"
)

/** Insert any seed artifact whose capability id is not yet in the DB. */
export const seedCapabilities = (db: Database.Database): void => {
  if (!fs.existsSync(SEEDS_DIR)) return
  for (const file of fs.readdirSync(SEEDS_DIR)) {
    if (!file.endsWith(".json")) continue
    const artifact = CapabilityArtifactSchema.parse(
      JSON.parse(fs.readFileSync(path.join(SEEDS_DIR, file), "utf8"))
    )
    if (getCapability(db, artifact.id)) continue // never clobber existing
    insertCapability(db, {
      id: artifact.id,
      version: artifact.version,
      name: artifact.name,
      risk: artifact.risk,
      reviewed: artifact.reviewed ? 1 : 0,
      createdAt: artifact.createdAt,
      artifact: JSON.stringify(artifact),
    })
    console.log(`seeded capability "${artifact.id}" v${artifact.version}`)
  }
}
