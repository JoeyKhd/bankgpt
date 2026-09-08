
import { chromium } from "playwright"
import { replayCapability } from "./src/replay.js"
import { defaultPolicy } from "./src/policy.js"
import { createEvidenceWriter } from "./src/evidence.js"
import { readFileSync } from "node:fs"

const artifact = JSON.parse(readFileSync("evidence/artifacts/get_member_balances.json", "utf8"))
console.log("step0:", JSON.stringify(artifact.steps[0], null, 1))

const browser = await chromium.launch({ headless: true })
const evidence = createEvidenceWriter("evidence", "probe-run")
const result = await replayCapability({
  browser,
  artifact,
  inputs: { memberId: "100231" },
  policy: defaultPolicy(),
  evidence,
  runId: "probe-run",
  approved: true,
  events: { onStep: (i, s, ok) => console.log("step", i, s.action, ok) },
})
console.log(JSON.stringify(result, null, 1))
await browser.close()
