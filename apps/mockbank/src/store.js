// In-memory store for the mock bank. State is rebuilt from the deterministic
// seed on startup and whenever POST /__reset__ is called, so evidence runs are
// reproducible.

import { SEED_MEMBERS } from "./seed.js"

// Account numbers and confirmation numbers issued after a reset are derived
// from monotonic counters so a fresh run always produces the same values.
const FIRST_NEW_ACCOUNT_NUMBER = 7100070001
const FIRST_CONFIRMATION_NUMBER = 5001

export const createStore = () => {
  const state = {
    members: [],
    nextAccountNumber: FIRST_NEW_ACCOUNT_NUMBER,
    nextConfirmationNumber: FIRST_CONFIRMATION_NUMBER,
  }

  const reset = () => {
    state.members = structuredClone(SEED_MEMBERS)
    state.nextAccountNumber = FIRST_NEW_ACCOUNT_NUMBER
    state.nextConfirmationNumber = FIRST_CONFIRMATION_NUMBER
  }

  const findMember = (id) => state.members.find((member) => member.id === id)

  const findCard = (member, last4) =>
    member.cards.find((card) => card.last4 === last4)

  const openAccount = (member, { accountType, initialDeposit, nickname }) => {
    const account = {
      number: String(state.nextAccountNumber++),
      type: accountType,
      balance: initialDeposit,
      nickname: nickname || "",
    }
    member.accounts.push(account)
    const confirmationNumber = `CNF-${state.nextConfirmationNumber++}`
    return { account, confirmationNumber }
  }

  const freezeCard = (card, reason) => {
    card.status = "Frozen"
    card.frozenReason = reason
    card.frozenAt = new Date().toISOString()
  }

  reset()

  return { state, reset, findMember, findCard, openAccount, freezeCard }
}
