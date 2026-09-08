// FinCore Teller (proxy) — zero-dependency mock back-office banking console.
// Plain node:http server; see README.md for the deliberate-hostility list.

import http from "node:http"
import { randomBytes } from "node:crypto"
import { createStore } from "./store.js"
import * as views from "./views.js"

const PORT = Number(process.env.PORT || 4010)
const HOST = "127.0.0.1"
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 5 * 60 * 1000)
const SESSION_COOKIE = "mockbank_session"

const store = createStore()

// session token -> { username, lastActivity, getCount }
const sessions = new Map()

const parseCookies = (req) => {
  const header = req.headers.cookie || ""
  const cookies = {}
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq > -1) cookies[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
  }
  return cookies
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (chunk) => chunks.push(chunk))
    req.on("end", () =>
      resolve(new URLSearchParams(Buffer.concat(chunks).toString("utf8"))),
    )
    req.on("error", reject)
  })

const sendHtml = (res, status, html, headers = {}) => {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    ...headers,
  })
  res.end(html)
}

const redirect = (res, location, headers = {}) => {
  res.writeHead(302, { Location: location, ...headers })
  res.end()
}

const getSession = (req) => {
  const token = parseCookies(req)[SESSION_COOKIE]
  if (!token) return { token: null, session: null }
  return { token, session: sessions.get(token) || null }
}

const isExpired = (session) => Date.now() - session.lastActivity > SESSION_TTL_MS

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`)
  const path = url.pathname

  // Browser bookkeeping: never counted, never delayed, never gated.
  if (path === "/favicon.ico") {
    res.writeHead(204)
    res.end()
    return
  }

  // Test harness reset: reseeds members/accounts/cards and drops all sessions
  // so evidence runs start from a fully deterministic state.
  if (path === "/__reset__" && req.method === "POST") {
    store.reset()
    sessions.clear()
    res.writeHead(200, { "Content-Type": "text/plain" })
    res.end("mockbank state reset")
    return
  }

  const { token, session } = getSession(req)

  // Public pages.
  if (path === "/login") {
    if (req.method === "GET") {
      sendHtml(res, 200, views.loginPage())
      return
    }
    if (req.method === "POST") {
      const body = await readBody(req)
      const newToken = randomBytes(24).toString("hex")
      sessions.set(newToken, {
        username: body.get("username") || "teller",
        lastActivity: Date.now(),
        getCount: 0,
      })
      redirect(res, "/dashboard", {
        "Set-Cookie": `${SESSION_COOKIE}=${newToken}; HttpOnly; Path=/; SameSite=Lax`,
      })
      return
    }
  }

  if (path === "/session-expired" && req.method === "GET") {
    sendHtml(res, 200, views.sessionExpiredPage())
    return
  }

  // Everything below requires a live session.
  if (!session) {
    redirect(res, "/login")
    return
  }
  if (isExpired(session)) {
    if (token) sessions.delete(token)
    redirect(res, "/session-expired")
    return
  }
  session.lastActivity = Date.now()

  if (path === "/logout" && req.method === "GET") {
    sessions.delete(token)
    redirect(res, "/login")
    return
  }

  if ((path === "/" || path === "/dashboard") && req.method === "GET") {
    if (path === "/") {
      redirect(res, "/dashboard")
      return
    }
    sendHtml(res, 200, views.dashboardPage())
    return
  }

  if (path === "/search/results" && req.method === "GET") {
    const query = (url.searchParams.get("q") || "").trim()
    const lowered = query.toLowerCase()
    const matches = store.state.members.filter(
      (member) =>
        member.id === query || member.name.toLowerCase().includes(lowered),
    )
    sendHtml(res, 200, views.searchResultsPage(query, matches))
    return
  }

  const memberMatch = path.match(/^\/members\/(\d+)$/)
  if (memberMatch && req.method === "GET") {
    const member = store.findMember(memberMatch[1])
    if (!member) {
      sendHtml(
        res,
        404,
        views.messagePage(
          "Member not found",
          "Member not found",
          `No member exists with ID <b>${views.esc(memberMatch[1])}</b>.`,
        ),
      )
      return
    }
    sendHtml(res, 200, views.memberPage(member, url.searchParams.get("notice") || ""))
    return
  }

  sendHtml(res, 404, views.notFoundPage())
})

server.listen(PORT, HOST, () => {
  console.log(`FinCore Teller (mockbank) listening on http://${HOST}:${PORT}`)
  console.log(`Session inactivity timeout: ${SESSION_TTL_MS}ms`)
})
