// FinCore Teller (proxy) — deliberately hostile mock back-office banking
// console. Hono keeps the local target's routes explicit while preserving the
// legacy HTML surface the engine discovers and replays.

import { randomBytes } from "node:crypto"

import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"

import { createStore, type Member } from "@/store"
import * as views from "@/views"

const PORT = Number(process.env.PORT ?? 4010)
const HOST = process.env.MOCKBANK_HOST ?? "127.0.0.1"
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS ?? 5 * 60 * 1000)
const SESSION_COOKIE = "mockbank_session"
const NO_DELAY = process.env.MOCKBANK_NO_DELAY === "1"

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

// Deliberate hostility: transient slowness. Every page sleeps 50-400ms; the
// search endpoint sleeps 1-2s. MOCKBANK_NO_DELAY=1 disables it for dev loops.
const delayFor = async (path: string): Promise<void> => {
  if (NO_DELAY) return
  const ms =
    path === "/search/results"
      ? 1000 + Math.floor(Math.random() * 1001)
      : 50 + Math.floor(Math.random() * 351)
  await sleep(ms)
}

type TellerSession = {
  username: string
  lastActivity: number
  getCount: number
}

const store = createStore()
const sessions = new Map<string, TellerSession>()
const ACCOUNT_TYPES = new Set(["savings", "checking", "money-market"])
const FREEZE_REASONS = new Set([
  "lost",
  "stolen",
  "fraud-suspected",
  "member-request",
])

type AppVariables = {
  sessionToken: string
  session: TellerSession
}

const app = new Hono<{ Variables: AppVariables }>()

const html = (
  content: string,
  status = 200,
  headers?: Record<string, string>
) =>
  new Response(content, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...headers,
    },
  })

const errorPage = (): string => `<!DOCTYPE html>
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

const isExpired = (session: TellerSession): boolean =>
  Date.now() - session.lastActivity > SESSION_TTL_MS

type FormBody = Record<string, unknown>

const formValue = (body: FormBody, key: string): string => {
  const value = body[key]
  return typeof value === "string" ? value.trim() : ""
}

const readAccountValues = (body: FormBody): views.AccountValues => ({
  accountType: formValue(body, "accountType"),
  initialDeposit: formValue(body, "initialDeposit"),
  nickname: formValue(body, "nickname"),
})

// Server-side validation for the open sub-account flow. Invalid input never
// creates an account; the form or review step re-renders with an error.
const validateAccountInput = (
  values: views.AccountValues
): { ok: true; value: number } | { ok: false; error: string } => {
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
    return {
      ok: false,
      error: "Initial deposit cannot be negative. Enter 0 or more.",
    }
  }
  return { ok: true, value: Math.round(amount * 100) / 100 }
}

const memberNotFound = (id: string): string =>
  views.messagePage(
    "Member not found",
    "Member not found",
    `No member exists with ID <b>${views.esc(id)}</b>.`
  )

const isNumericId = (id: string | undefined): id is string =>
  id !== undefined && /^\d+$/.test(id)

const findMemberOr404 = (id: string | undefined): Member | Response => {
  const member = id ? store.findMember(id) : undefined
  return member ?? html(memberNotFound(id ?? ""), 404)
}

// Browser bookkeeping: never counted, never delayed, never gated.
app.get("/favicon.ico", (c) => c.body(null, 204))

// Test harness reset: reseeds members/accounts/cards and drops all sessions
// so evidence runs start from a fully deterministic state.
app.post("/__reset__", (c) => {
  store.reset()
  sessions.clear()
  return c.text("mockbank state reset")
})

// Deliberate hostility: per session, every 7th authenticated GET returns a
// transient 500 ("Core system unavailable") and recovers on retry.
app.use("*", async (c, next) => {
  const token = getCookie(c)[SESSION_COOKIE]
  const session = token ? sessions.get(token) : undefined
  if (session && !isExpired(session) && c.req.method === "GET") {
    session.getCount += 1
    if (session.getCount % 7 === 0) {
      return html(errorPage(), 500)
    }
  }
  await next()
})

app.get("/login", () => html(views.loginPage()))

app.post("/login", async (c) => {
  await delayFor(c.req.path)
  const body = await c.req.parseBody()
  const token = randomBytes(24).toString("hex")
  sessions.set(token, {
    username: typeof body.username === "string" ? body.username : "teller",
    lastActivity: Date.now(),
    getCount: 0,
  })
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
  })
  return c.redirect("/dashboard")
})

app.get("/session-expired", async (c) => {
  await delayFor(c.req.path)
  return html(views.sessionExpiredPage())
})

// Everything below requires a live session.
app.use("*", async (c, next) => {
  const token = getCookie(c)[SESSION_COOKIE]
  const session = token ? sessions.get(token) : undefined
  if (!token || !session) {
    await delayFor(c.req.path)
    return c.redirect("/login")
  }
  if (isExpired(session)) {
    sessions.delete(token)
    deleteCookie(c, SESSION_COOKIE, { path: "/" })
    await delayFor(c.req.path)
    return c.redirect("/session-expired")
  }
  session.lastActivity = Date.now()
  await delayFor(c.req.path)
  c.set("sessionToken", token)
  c.set("session", session)
  await next()
})

app.get("/logout", (c) => {
  sessions.delete(c.get("sessionToken"))
  deleteCookie(c, SESSION_COOKIE, { path: "/" })
  return c.redirect("/login")
})

app.get("/", (c) => c.redirect("/dashboard"))
app.get("/dashboard", () => html(views.dashboardPage()))

app.get("/search/results", (c) => {
  const query = (c.req.query("q") || "").trim()
  const lowered = query.toLowerCase()
  const matches = store.state.members.filter(
    (member) =>
      member.id === query || member.name.toLowerCase().includes(lowered)
  )
  return html(views.searchResultsPage(query, matches))
})

app.get("/members/:id", (c) => {
  const id = c.req.param("id")
  if (!isNumericId(id)) return html(views.notFoundPage(), 404)
  const member = findMemberOr404(id)
  if (member instanceof Response) return member
  return html(views.memberPage(member, c.req.query("notice") || ""))
})

// --- Open sub-account flow -------------------------------------------------

app.get("/members/:id/accounts/new", (c) => {
  const id = c.req.param("id")
  if (!isNumericId(id)) return html(views.notFoundPage(), 404)
  const member = findMemberOr404(id)
  if (member instanceof Response) return member
  return html(
    views.accountFormPage(member, {
      accountType: "savings",
      initialDeposit: "",
      nickname: "",
    })
  )
})

app.post("/members/:id/accounts/review", async (c) => {
  const id = c.req.param("id")
  if (!isNumericId(id)) return html(views.notFoundPage(), 404)
  const member = findMemberOr404(id)
  if (member instanceof Response) return member
  const values = readAccountValues(await c.req.parseBody())
  const result = validateAccountInput(values)
  if (!result.ok) {
    return html(views.accountFormPage(member, values, result.error))
  }
  return html(views.reviewPage(member, values, result.value))
})

app.post("/members/:id/accounts", async (c) => {
  const id = c.req.param("id")
  if (!isNumericId(id)) return html(views.notFoundPage(), 404)
  const member = findMemberOr404(id)
  if (member instanceof Response) return member
  const body = await c.req.parseBody()
  const values = readAccountValues(body)
  const result = validateAccountInput(values)
  if (!result.ok) {
    return html(views.accountFormPage(member, values, result.error))
  }
  if (body.acknowledge !== "yes") {
    return html(
      views.reviewPage(
        member,
        values,
        result.value,
        "You must check the confirmation box to open the sub-account."
      )
    )
  }
  const { account, confirmationNumber } = store.openAccount(member, {
    accountType: values.accountType,
    initialDeposit: result.value,
    nickname: values.nickname,
  })
  return c.redirect(
    `/members/${member.id}/accounts/${account.number}/confirmation?c=${confirmationNumber}`
  )
})

// --- Freeze card flow ------------------------------------------------------

const freezeCardRoute = async (c: {
  req: {
    param: (name: string) => string | undefined
    parseBody: () => Promise<Record<string, unknown>>
    method: string
  }
  redirect: (location: string) => Response
}): Promise<Response> => {
  const memberId = c.req.param("id")
  const last4 = c.req.param("last4")
  if (!isNumericId(memberId) || !/^\d{4}$/.test(last4 ?? "")) {
    return html(views.notFoundPage(), 404)
  }
  const member = findMemberOr404(memberId)
  if (member instanceof Response) return member
  const card = store.findCard(member, last4 ?? "")
  if (!card) {
    return html(
      views.messagePage(
        "Card not found",
        "Card not found",
        `This member has no card ending in <b>${views.esc(last4 ?? "")}</b>.`
      ),
      404
    )
  }
  if (card.status === "Frozen") {
    // Business outcome, not an error: the console says so with HTTP 200.
    return html(
      views.messagePage(
        "Card is already frozen",
        "Card is already frozen",
        `Card &#8226;&#8226;&#8226;&#8226; ${views.esc(card.last4)} for ${views.esc(member.name)} is already frozen (reason: ${views.esc(card.frozenReason)}). No changes were made.`
      )
    )
  }
  if (c.req.method === "GET") {
    return html(views.freezePage(member, card))
  }
  const body = await c.req.parseBody()
  const reason = formValue(body, "reason")
  if (!FREEZE_REASONS.has(reason)) {
    return html(views.freezePage(member, card))
  }
  store.freezeCard(card, reason)
  return c.redirect(
    `/members/${member.id}?notice=${encodeURIComponent(
      `Card .... ${card.last4} is now Frozen (${reason}).`
    )}`
  )
}

app.get("/members/:id/cards/:last4/freeze", freezeCardRoute)
app.post("/members/:id/cards/:last4/freeze", freezeCardRoute)

app.get("/members/:id/accounts/:accountNumber/confirmation", (c) => {
  const id = c.req.param("id")
  if (!isNumericId(id)) return html(views.notFoundPage(), 404)
  const member = findMemberOr404(id)
  if (member instanceof Response) return member
  const account = member.accounts.find(
    (entry) => entry.number === c.req.param("accountNumber")
  )
  const confirmationNumber = (c.req.query("c") || "").trim()
  if (!account || !/^CNF-\d+$/.test(confirmationNumber)) {
    return html(
      views.messagePage(
        "Confirmation not found",
        "Confirmation not found",
        "This confirmation page is not available. The account may not exist, or the state was reset."
      ),
      404
    )
  }
  return html(views.confirmationPage(member, account, confirmationNumber))
})

app.notFound(() => html(views.notFoundPage(), 404))

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
  console.log(`FinCore Teller (mockbank) listening on http://${HOST}:${PORT}`)
  console.log(`Session inactivity timeout: ${SESSION_TTL_MS}ms`)
})
