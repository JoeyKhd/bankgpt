// Throwaway fixture server for engine development: serves the static
// member-lookup page (with a search form, detail view, and not-found path)
// on a fixed local port. Not part of the product — apps/mockbank replaces it.
import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const PORT = 4523
const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "member-lookup.html"), "utf8")

const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
  res.end(html)
})
server.listen(PORT, "127.0.0.1", () => {
  console.log(`fixture listening on http://127.0.0.1:${PORT}`)
})
