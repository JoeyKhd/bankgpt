// FinCore Teller (proxy) — zero-dependency mock back-office banking console.
// Plain node:http server; see README.md for the deliberate-hostility list.

import http from "node:http"
import { randomBytes } from "node:crypto"
import { createStore } from "./store.js"
import * as views from "./views.js"

const PORT = Number(process.env.PORT || 4010)
const HOST = "127.0.0.1"

// Deliberate hostility: transient slowness. Every page sleeps 50-400ms; the
// search endpoint sleeps 1-2s. MOCKBANK_NO_DELAY=1 disables it for dev loops.
const NO_DELAY = process.env.MOCKBANK_NO_DELAY === "1"
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const delayFor = (path) => {
  if (NO_DELAY) return Promise.resolve()
  const ms =
    path === "/search/results"
      ? 1000 + Math.floor(Math.random() * 1001)
      : 50 + Math.floor(Math.random() * 351)
  return sleep(ms)
}

const errorPage = () => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>FinCore Teller - Core system unavailable</title></head>
<body style="font-family: Tahoma, Verdana, Arial, sans-serif; background: #c9ced6;">
<table class="tbl" width="100%" cellpadding="0" cellspacing="0"><tr class="row"><td class="cell" bgcolor="#0f2d52">
<b style="color:#ffffff">FinCore Teller</b>
</td></tr><tr class="row"><td class="cell" bgcolor="#ffffff" style="padding:24px;">
<h1>Core system unavailable &mdash; try again</h1>
<p>The FinCore core system did not respond. This is usually temporary: wait a moment and try the same action again.</p>
</td></tr></table>
</body>
</html>`
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 5 * 60 * 1000)
const SESSION_COOKIE = "mockbank_session"

const store = createStore()

// session token -> { username, lastActivity, getCount }
const sessions = new Map()

const ACCOUNT_TYPES = new Set(["savings", "checking", "money-market"])

const readAccountValues = (body) => ({
  accountType: (body.get("accountType") || "").trim(),
  initialDeposit: (body.get("initialDeposit") || "").trim(),
  nickname: (body.get("nickname") || "").trim(),
})

// Server-side validation for the open sub-account flow. Invalid input never
// creates an account; the form or review step re-renders with an error.
const validateAccountInput = (values) => {
  if (!ACCOUNT_TYPES.has(values.accountType)) {
    return {
      ok: false,
      error: "Choose a valid account type: savings, checking, or money-market.",
    }
  }
  const normalized = values.initialDeposit.replace(/,/g, "")
  const amount = Number(normalized)
  if (normalized === "" || !Number.isFinite(amount)) {
    return { ok: false, error: "Initial deposit must be a number (0 or more)." }
  }
  if (amount < 0) {
    return { ok: false, error: "Initial deposit cannot be negative. Enter 0 or more." }
  }
  return { ok: true, value: Math.round(amount * 100) / 100 }
}

const memberNotFound = (id) =>
  views.messagePage(
    "Member not found",
    "Member not found",
    `No member exists with ID <b>${views.esc(id)}</b>.`,
  )

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

  // Deliberate hostility: per-session, every 7th GET returns a transient 500
  // ("Core system unavailable") and recovers on retry. Deterministic so
  // evidence runs can rely on it. Public pages are never hit.
  if (session && !isExpired(session) && req.method === "GET") {
    session.getCount += 1
    if (session.getCount % 7 === 0) {
      sendHtml(res, 500, errorPage())
      return
    }
  }

  // Public pages.
  if (path === "/login") {
    if (req.method === "GET") {
      sendHtml(res, 200, views.loginPage())
      return
    }
    if (req.method === "POST") {
      await delayFor(path)
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
    await delayFor(path)
    sendHtml(res, 200, views.sessionExpiredPage())
    return
  }

  // Everything below requires a live session.
  if (!session) {
    await delayFor(path)
    redirect(res, "/login")
    return
  }
  if (isExpired(session)) {
    if (token) sessions.delete(token)
    await delayFor(path)
    redirect(res, "/session-expired")
    return
  }
  session.lastActivity = Date.now()

  await delayFor(path)

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

  // --- Open sub-account flow -------------------------------------------------

  const newAccountMatch = path.match(/^\/members\/(\d+)\/accounts\/new$/)
  if (newAccountMatch && req.method === "GET") {
    const member = store.findMember(newAccountMatch[1])
    if (!member) {
      sendHtml(res, 404, memberNotFound(newAccountMatch[1]))
      return
    }
    sendHtml(
      res,
      200,
      views.accountFormPage(member, {
        accountType: "savings",
        initialDeposit: "",
        nickname: "",
      }),
    )
    return
  }

  const reviewMatch = path.match(/^\/members\/(\d+)\/accounts\/review$/)
  if (reviewMatch && req.method === "POST") {
    const member = store.findMember(reviewMatch[1])
    if (!member) {
      sendHtml(res, 404, memberNotFound(reviewMatch[1]))
      return
    }
    const values = readAccountValues(await readBody(req))
    const result = validateAccountInput(values)
    if (!result.ok) {
      // Validation-error path: the form re-renders with the entered values.
      sendHtml(res, 200, views.accountFormPage(member, values, result.error))
      return
    }
    sendHtml(res, 200, views.reviewPage(member, values, result.value))
    return
  }

  const createMatch = path.match(/^\/members\/(\d+)\/accounts$/)
  if (createMatch && req.method === "POST") {
    const member = store.findMember(createMatch[1])
    if (!member) {
      sendHtml(res, 404, memberNotFound(createMatch[1]))
      return
    }
    const body = await readBody(req)
    const values = readAccountValues(body)
    const result = validateAccountInput(values)
    if (!result.ok) {
      sendHtml(res, 200, views.accountFormPage(member, values, result.error))
      return
    }
    if (body.get("acknowledge") !== "yes") {
      sendHtml(
        res,
        200,
        views.reviewPage(
          member,
          values,
          result.value,
          "You must check the confirmation box to open the sub-account.",
        ),
      )
      return
    }
    const { account, confirmationNumber } = store.openAccount(member, {
      accountType: values.accountType,
      initialDeposit: result.value,
      nickname: values.nickname,
    })
    redirect(
      res,
      `/members/${member.id}/accounts/${account.number}/confirmation?c=${confirmationNumber}`,
    )
    return
  }

  // --- Freeze card flow ------------------------------------------------------

  const FREEZE_REASONS = new Set(["lost", "stolen", "fraud-suspected", "member-request"])

  const freezeMatch = path.match(/^\/members\/(\d+)\/cards\/(\d{4})\/freeze$/)
  if (freezeMatch) {
    const member = store.findMember(freezeMatch[1])
    if (!member) {
      sendHtml(res, 404, memberNotFound(freezeMatch[1]))
      return
    }
    const card = store.findCard(member, freezeMatch[2])
    if (!card) {
      sendHtml(
        res,
        404,
        views.messagePage(
          "Card not found",
          "Card not found",
          `This member has no card ending in <b>${views.esc(freezeMatch[2])}</b>.`,
        ),
      )
      return
    }
    if (card.status === "Frozen") {
      // Business outcome, not an error: the console says so with HTTP 200.
      sendHtml(
        res,
        200,
        views.messagePage(
          "Card is already frozen",
          "Card is already frozen",
          `Card &#8226;&#8226;&#8226;&#8226; ${views.esc(card.last4)} for ${views.esc(
            member.name,
          )} is already frozen (reason: ${views.esc(card.frozenReason)}). No changes were made.`,
        ),
      )
      return
    }
    if (req.method === "GET") {
      sendHtml(res, 200, views.freezePage(member, card))
      return
    }
    if (req.method === "POST") {
      const body = await readBody(req)
      const reason = (body.get("reason") || "").trim()
      if (!FREEZE_REASONS.has(reason)) {
        sendHtml(res, 200, views.freezePage(member, card))
        return
      }
      store.freezeCard(card, reason)
      redirect(
        res,
        `/members/${member.id}?notice=${encodeURIComponent(
          `Card .... ${card.last4} is now Frozen (${reason}).`,
        )}`,
      )
      return
    }
  }

  const confirmationMatch = path.match(
    /^\/members\/(\d+)\/accounts\/(\d+)\/confirmation$/,
  )
  if (confirmationMatch && req.method === "GET") {
    const member = store.findMember(confirmationMatch[1])
    const account =
      member &&
      member.accounts.find((entry) => entry.number === confirmationMatch[2])
    const confirmationNumber = (url.searchParams.get("c") || "").trim()
    if (!member || !account || !/^CNF-\d+$/.test(confirmationNumber)) {
      sendHtml(
        res,
        404,
        views.messagePage(
          "Confirmation not found",
          "Confirmation not found",
          "This confirmation page is not available. The account may not exist, or the state was reset.",
        ),
      )
      return
    }
    sendHtml(res, 200, views.confirmationPage(member, account, confirmationNumber))
    return
  }

  sendHtml(res, 404, views.notFoundPage())
})

server.listen(PORT, HOST, () => {
  console.log(`FinCore Teller (mockbank) listening on http://${HOST}:${PORT}`)
  console.log(`Session inactivity timeout: ${SESSION_TTL_MS}ms`)
})
