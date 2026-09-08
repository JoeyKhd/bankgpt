// HTML rendering for the FinCore Teller mock. Deliberately legacy: deeply
// nested <table> layouts, generic class names ("tbl", "row", "cell"), no id
// attributes, no data-* attributes, no ARIA roles. Interactive elements are
// real <a>, <button>, <input>, <select>, and <label> tags so accessibility
// tree locators still work.

export const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

export const money = (amount) =>
  amount.toLocaleString("en-US", { style: "currency", currency: "USD" })

const baseStyles = `
  body { background: #c9ced6; font-family: Tahoma, Verdana, Arial, sans-serif; font-size: 13px; color: #1a1a1a; margin: 0; }
  h1 { font-size: 18px; color: #0f2d52; margin: 4px 0 10px; }
  h2 { font-size: 14px; color: #0f2d52; margin: 12px 0 4px; }
  a { color: #0b4da2; }
  .tbl { border-collapse: collapse; }
  .hdr { background: #0f2d52; color: #ffffff; font-weight: bold; }
  .cell { padding: 6px; vertical-align: top; }
  .err { background: #fbe3e3; border: 1px solid #c0392b; color: #7b1f16; padding: 6px; }
  .msg { background: #e6f4e6; border: 1px solid #2e7d32; color: #1b4d1f; padding: 6px; }
  th.cell { background: #d7dce4; border: 1px solid #8a93a1; text-align: left; }
  td.cell { border-color: #8a93a1; }
  table[border="1"] td.cell { border: 1px solid #8a93a1; }
  input, select, button { font-family: inherit; font-size: 13px; }
  button { background: #e8e8e8; border: 1px solid #777; padding: 3px 12px; cursor: pointer; }
  .foot { color: #5a6270; font-size: 11px; }
`

// Outer page shell: three nested levels of layout tables around the content,
// like a real 2003-era back-office console.
export const layout = (title, content, { signedIn = true } = {}) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>FinCore Teller - ${esc(title)}</title>
<style>${baseStyles}</style>
</head>
<body>
<table class="tbl" width="100%" cellpadding="0" cellspacing="0">
  <tr class="row">
    <td class="cell hdr">
      <table class="tbl" width="100%">
        <tr class="row">
          <td class="cell hdr"><b>FinCore Teller</b> &mdash; back-office console</td>
          <td class="cell hdr" align="right">${
            signedIn
              ? '<a href="/dashboard" style="color:#ffffff">Dashboard</a> &nbsp;|&nbsp; <a href="/logout" style="color:#ffffff">Log out</a>'
              : '<a href="/login" style="color:#ffffff">Log in</a>'
          }</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr class="row">
    <td class="cell" bgcolor="#c9ced6">
      <table class="tbl" width="100%" cellpadding="10">
        <tr class="row">
          <td class="cell" bgcolor="#ffffff" width="100%">
            <table class="tbl" width="100%">
              <tr class="row">
                <td class="cell">${content}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr class="row">
    <td class="cell foot">FinCore Federal Credit Union core system v3.7 &mdash; authorized tellers only. Sessions end after 5 minutes of inactivity.</td>
  </tr>
</table>
</body>
</html>`

export const loginPage = () =>
  layout(
    "Teller sign in",
    `<h1>Teller sign in</h1>
     <table class="tbl"><tr class="row"><td class="cell">
       <form method="post" action="/login">
         <table class="tbl" border="1" cellpadding="8">
           <tr class="row"><td class="cell" colspan="2">Sign in to the FinCore teller console.<br><b>Demo environment: any credentials work.</b></td></tr>
           <tr class="row"><td class="cell"><label>Username <input type="text" name="username" size="24"></label></td>
               <td class="cell"><label>Password <input type="password" name="password" size="24"></label></td></tr>
           <tr class="row"><td class="cell" colspan="2"><button type="submit">Log in</button></td></tr>
         </table>
       </form>
     </td></tr></table>`,
    { signedIn: false },
  )

export const sessionExpiredPage = () =>
  layout(
    "Session expired",
    `<h1>Session expired</h1>
     <p>Your teller session ended after 5 minutes of inactivity. Any unsaved work was discarded.</p>
     <p><a href="/login">Log in again</a></p>`,
    { signedIn: false },
  )

export const dashboardPage = () =>
  layout(
    "Teller dashboard",
    `<h1>Teller dashboard</h1>
     <table class="tbl"><tr class="row"><td class="cell">
       <p>Search for a member to view balances, open a sub-account, or freeze a debit card.</p>
       <form method="get" action="/search/results">
         <table class="tbl" border="1" cellpadding="8">
           <tr class="row">
             <td class="cell"><label>Member ID or name <input type="text" name="q" size="32"></label></td>
             <td class="cell"><button type="submit">Search</button></td>
           </tr>
         </table>
       </form>
     </td></tr></table>`,
  )

export const searchResultsPage = (query, matches) => {
  const rows = matches
    .map(
      (member) => `<tr class="row">
        <td class="cell">${esc(member.id)}</td>
        <td class="cell">${esc(member.name)}</td>
        <td class="cell">${esc(member.address)}</td>
        <td class="cell"><a href="/members/${esc(member.id)}">View member</a></td>
      </tr>`,
    )
    .join("\n")

  const body =
    matches.length === 0
      ? `<table class="tbl" border="1" cellpadding="8"><tr class="row"><td class="cell">
           <b>No member found</b> for &ldquo;${esc(query)}&rdquo;.<br>
           Check the member ID or spelling and try again. Members are listed by their numeric member ID.
         </td></tr></table>`
      : `<table class="tbl" border="1" cellpadding="6" cellspacing="0">
           <tr class="row"><th class="cell">Member ID</th><th class="cell">Name</th><th class="cell">Address</th><th class="cell">&nbsp;</th></tr>
           ${rows}
         </table>`

  return layout(
    "Member search results",
    `<h1>Member search</h1>
     <table class="tbl"><tr class="row"><td class="cell">
       <p>Results for &ldquo;${esc(query)}&rdquo; &mdash; ${matches.length} member(s).</p>
       ${body}
       <p><a href="/dashboard">New search</a></p>
     </td></tr></table>`,
  )
}

const accountRows = (member) =>
  member.accounts
    .map(
      (account) => `<tr class="row">
        <td class="cell">${esc(account.type)}</td>
        <td class="cell">${esc(account.number)}</td>
        <td class="cell">${esc(account.nickname || "-")}</td>
        <td class="cell" align="right">${money(account.balance)}</td>
      </tr>`,
    )
    .join("\n")

const cardRows = (member) =>
  member.cards
    .map((card) => {
      const status =
        card.status === "Frozen"
          ? `Frozen (${esc(card.frozenReason)})`
          : "Active"
      const action =
        card.status === "Frozen"
          ? "&mdash;"
          : `<a href="/members/${esc(member.id)}/cards/${esc(card.last4)}/freeze">Freeze card</a>`
      return `<tr class="row">
        <td class="cell">&#8226;&#8226;&#8226;&#8226; ${esc(card.last4)}</td>
        <td class="cell">${esc(card.network)}</td>
        <td class="cell">${status}</td>
        <td class="cell">${action}</td>
      </tr>`
    })
    .join("\n")

export const memberPage = (member, notice = "") =>
  layout(
    `Member ${member.id}`,
    `${notice ? `<p class="msg">${esc(notice)}</p>` : ""}
     <h1>Member: ${esc(member.name)}</h1>
     <table class="tbl"><tr class="row"><td class="cell">
       <table class="tbl" border="1" cellpadding="6">
         <tr class="row"><th class="cell">Member ID</th><td class="cell">${esc(member.id)}</td></tr>
         <tr class="row"><th class="cell">Name</th><td class="cell">${esc(member.name)}</td></tr>
         <tr class="row"><th class="cell">Address</th><td class="cell">${esc(member.address)}</td></tr>
       </table>
     </td></tr>
     <tr class="row"><td class="cell">
       <h2>Accounts</h2>
       <table class="tbl" border="1" cellpadding="6" cellspacing="0">
         <tr class="row"><th class="cell">Type</th><th class="cell">Account number</th><th class="cell">Nickname</th><th class="cell">Balance</th></tr>
         ${accountRows(member)}
       </table>
       <p><a href="/members/${esc(member.id)}/accounts/new">Open sub-account</a></p>
     </td></tr>
     <tr class="row"><td class="cell">
       <h2>Debit cards</h2>
       <table class="tbl" border="1" cellpadding="6" cellspacing="0">
         <tr class="row"><th class="cell">Card</th><th class="cell">Network</th><th class="cell">Status</th><th class="cell">Action</th></tr>
         ${cardRows(member)}
       </table>
     </td></tr></table>`,
  )

export const messagePage = (title, heading, message) =>
  layout(
    title,
    `<h1>${esc(heading)}</h1>
     <table class="tbl" border="1" cellpadding="8"><tr class="row"><td class="cell">${message}</td></tr></table>
     <p><a href="/dashboard">Back to dashboard</a></p>`,
  )

export const notFoundPage = () =>
  messagePage("Not found", "Page not found", "The requested page does not exist on this console.")
