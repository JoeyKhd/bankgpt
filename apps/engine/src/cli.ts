/**
 * Engine CLI — the demo entrypoint (assignment README commands):
 *
 *   pnpm --filter engine discover --goal "..." --target http://localhost:4010
 *   pnpm --filter engine replay --capability <id> --input key=value ...
 *
 * Both print structured JSON results to stdout. Discovery requires
 * OPENROUTER_API_KEY in the environment (loaded via --env-file by the
 * package scripts).
 */
import { chromium } from "playwright"
import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { runDiscovery } from "@/discovery"
import { replayCapability } from "@/replay"
import { defaultPolicy } from "@/policy"
import { createEvidenceWriter } from "@/evidence"
import { openEngineDb, insertCapability } from "@/db"
import { CapabilityArtifactSchema } from "@/artifact"

const DEFAULT_MODEL = "google/gemini-2.5-flash"

type CliArgs = {
  command: "discover" | "replay"
  goal?: string
  target?: string
  capability?: string
  model?: string
  inputs: Record<string, string>
}

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = { command: argv[2] as CliArgs["command"], inputs: {} }
  for (let i = 3; i < argv.length; i++) {
    const flag = argv[i]
    const next = () => argv[++i]
    switch (flag) {
      case "--goal":
        args.goal = next()
        break
      case "--target":
        args.target = next()
        break
      case "--capability":
        args.capability = next()
        break
      case "--model":
        args.model = next()
        break
      case "--input": {
        const kv = next() ?? ""
        const eq = kv.indexOf("=")
        if (eq > 0) args.inputs[kv.slice(0, eq)] = kv.slice(eq + 1)
        break
      }
    }
  }
  return args
}

const ENGINE_DB_PATH = process.env.ENGINE_DB_PATH ?? "data/engine.sqlite"
const EVIDENCE_DIR = process.env.ENGINE_EVIDENCE_DIR ?? "evidence"

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv)
  const policy = defaultPolicy()

  if (args.command === "discover") {
    if (!args.goal || !args.target) {
      console.error(
        'usage: discover --goal "..." --target http://localhost:4010 [--model id]'
      )
      process.exit(2)
    }
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      console.error("OPENROUTER_API_KEY is not set")
      process.exit(2)
    }
    const runId = randomUUID()
    const evidence = createEvidenceWriter(EVIDENCE_DIR, runId)
    const db = openEngineDb(ENGINE_DB_PATH)

    let savedArtifactId: string | undefined
    const result = await runDiscovery({
      goal: args.goal,
      targetUrl: args.target,
      policy,
      evidence,
      runId,
      model: args.model ?? DEFAULT_MODEL,
      apiKey,
      onArtifact: (artifact) => {
        insertCapability(db, {
          id: artifact.id,
          version: artifact.version,
          name: artifact.name,
          risk: artifact.risk,
          reviewed: 0,
          createdAt: artifact.createdAt,
          artifact: JSON.stringify(artifact),
        })
        // Also write the artifact next to the run evidence for review.
        mkdirSync(join(EVIDENCE_DIR, "artifacts"), { recursive: true })
        writeFileSync(
          join(EVIDENCE_DIR, "artifacts", `${artifact.id}.json`),
          JSON.stringify(artifact, null, 2)
        )
        savedArtifactId = artifact.id
      },
    })
    evidence.writeResult(result)
    console.log(JSON.stringify({ runId, savedArtifactId, result }, null, 2))
    return
  }

  if (args.command === "replay") {
    if (!args.capability) {
      console.error("usage: replay --capability <id> --input key=value ...")
      process.exit(2)
    }
    // Load the artifact from the evidence artifacts dir (written by discover).
    const artifactPath = join(
      EVIDENCE_DIR,
      "artifacts",
      `${args.capability}.json`
    )
    const artifact = CapabilityArtifactSchema.parse(
      JSON.parse(readFileSync(artifactPath, "utf8"))
    )
    const runId = randomUUID()
    const evidence = createEvidenceWriter(EVIDENCE_DIR, runId)
    const browser = await chromium.launch({ headless: true })
    try {
      const result = await replayCapability({
        browser,
        artifact,
        inputs: args.inputs,
        policy,
        evidence,
        runId,
        approved: true, // CLI runs are operator-invoked; approval is implicit.
      })
      evidence.writeResult(result)
      console.log(JSON.stringify({ runId, result }, null, 2))
    } finally {
      await browser.close()
    }
    return
  }

  console.error("unknown command: expected discover | replay")
  process.exit(2)
}

void main()
