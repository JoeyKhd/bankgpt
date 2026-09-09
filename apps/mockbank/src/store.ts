// In-memory store for the mock bank. State is rebuilt from the deterministic
// seed on startup and whenever POST /__reset__ is called, so evidence runs are
// reproducible.

import { SEED_MEMBERS, type Account, type Card, type Member } from "@/seed"

export type { Account, Card, Member }

export type OpenAccountInput = {
  accountType: string
  initialDeposit: number
  nickname: string
}

// Account numbers and confirmation numbers issued after a reset are derived
// from monotonic counters so a fresh run always produces the same values.
const FIRST_NEW_ACCOUNT_NUMBER = 7100070001
const FIRST_CONFIRMATION_NUMBER = 5001

export const createStore = () => {
  const state: {
    members: Member[]
    nextAccountNumber: number
    nextConfirmationNumber: number
  } = {
    members: [],
    nextAccountNumber: FIRST_NEW_ACCOUNT_NUMBER,
    nextConfirmationNumber: FIRST_CONFIRMATION_NUMBER,
  }

  const reset = (): void => {
    state.members = structuredClone(SEED_MEMBERS)
    state.nextAccountNumber = FIRST_NEW_ACCOUNT_NUMBER
    state.nextConfirmationNumber = FIRST_CONFIRMATION_NUMBER
  }

  const findMember = (id: string): Member | undefined =>
    state.members.find((member) => member.id === id)

  const findCard = (member: Member, last4: string): Card | undefined =>
    member.cards.find((card) => card.last4 === last4)

  const openAccount = (
    member: Member,
    { accountType, initialDeposit, nickname }: OpenAccountInput
  ): { account: Account; confirmationNumber: string } => {
    const account: Account = {
      number: String(state.nextAccountNumber++),
      type: accountType,
      balance: initialDeposit,
      nickname: nickname || "",
    }
    member.accounts.push(account)
    const confirmationNumber = `CNF-${state.nextConfirmationNumber++}`
    return { account, confirmationNumber }
  }

  const freezeCard = (card: Card, reason: string): void => {
    card.status = "Frozen"
    card.frozenReason = reason
    card.frozenAt = new Date().toISOString()
  }

  reset()

  return { state, reset, findMember, findCard, openAccount, freezeCard }
}
