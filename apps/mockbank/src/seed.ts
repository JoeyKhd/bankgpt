// Deterministic seed data for the FinCore Teller mock. All people, balances,
// account numbers, and cards are fictional and exist only for automation runs.

export type Account = {
  number: string
  type: string
  balance: number
  nickname: string
}

export type Card = {
  last4: string
  network: string
  status: "Active" | "Frozen"
  frozenReason: string
  frozenAt: string
}

export type Member = {
  id: string
  name: string
  address: string
  accounts: Account[]
  cards: Card[]
}

export const SEED_MEMBERS: Member[] = [
  {
    id: "100231",
    name: "Margaret Ellison",
    address: "412 Birchwood Lane, Dayton, OH 45419",
    accounts: [
      {
        number: "7100041201",
        type: "savings",
        balance: 12480.55,
        nickname: "Rainy day",
      },
      { number: "7100041202", type: "checking", balance: 1204.1, nickname: "" },
    ],
    cards: [
      {
        last4: "4412",
        network: "Visa",
        status: "Active",
        frozenReason: "",
        frozenAt: "",
      },
    ],
  },
  {
    id: "100774",
    name: "Deshawn Carter",
    address: "88 Fulton Street Apt 5B, Brooklyn, NY 11217",
    accounts: [
      { number: "7100044401", type: "checking", balance: 843.22, nickname: "" },
      {
        number: "7100044402",
        type: "savings",
        balance: 5900.0,
        nickname: "Vacation",
      },
      {
        number: "7100044403",
        type: "money-market",
        balance: 25340.75,
        nickname: "",
      },
    ],
    cards: [
      {
        last4: "8801",
        network: "Visa",
        status: "Active",
        frozenReason: "",
        frozenAt: "",
      },
      {
        last4: "9034",
        network: "Mastercard",
        status: "Frozen",
        frozenReason: "stolen",
        frozenAt: "2026-08-30T14:12:00.000Z",
      },
    ],
  },
  {
    id: "101045",
    name: "Priya Raman",
    address: "2300 Guadalupe Street, Austin, TX 78705",
    accounts: [
      { number: "7100047701", type: "savings", balance: 3412.89, nickname: "" },
      { number: "7100047702", type: "checking", balance: 915.4, nickname: "" },
    ],
    cards: [
      {
        last4: "2255",
        network: "Visa",
        status: "Active",
        frozenReason: "",
        frozenAt: "",
      },
    ],
  },
  {
    id: "102388",
    name: "Tom Kowalski",
    address: "17 Harbor View Drive, Duluth, MN 55802",
    accounts: [
      {
        number: "7100051101",
        type: "checking",
        balance: 19002.44,
        nickname: "",
      },
      { number: "7100051102", type: "savings", balance: 730.0, nickname: "" },
    ],
    cards: [
      {
        last4: "6630",
        network: "Visa",
        status: "Active",
        frozenReason: "",
        frozenAt: "",
      },
      {
        last4: "1188",
        network: "Visa",
        status: "Active",
        frozenReason: "",
        frozenAt: "",
      },
    ],
  },
  {
    id: "103520",
    name: "Lucia Fernandez",
    address: "502 Desert Willow Court, Tucson, AZ 85719",
    accounts: [
      {
        number: "7100058801",
        type: "savings",
        balance: 8977.31,
        nickname: "House fund",
      },
      {
        number: "7100058802",
        type: "money-market",
        balance: 41200.0,
        nickname: "",
      },
    ],
    cards: [
      {
        last4: "3456",
        network: "Mastercard",
        status: "Active",
        frozenReason: "",
        frozenAt: "",
      },
    ],
  },
  {
    id: "104816",
    name: "Aaron Blake",
    address: "9 Chestnut Street, Burlington, VT 05401",
    accounts: [
      { number: "7100062301", type: "checking", balance: 156.78, nickname: "" },
      { number: "7100062302", type: "savings", balance: 2480.0, nickname: "" },
    ],
    cards: [
      {
        last4: "7789",
        network: "Visa",
        status: "Frozen",
        frozenReason: "lost",
        frozenAt: "2026-09-02T09:41:00.000Z",
      },
    ],
  },
  {
    id: "105293",
    name: "Grace Nakamura",
    address: "1313 Mockingbird Lane, Portland, OR 97205",
    accounts: [
      { number: "7100065601", type: "savings", balance: 2050.0, nickname: "" },
      {
        number: "7100065602",
        type: "checking",
        balance: 4321.65,
        nickname: "",
      },
      {
        number: "7100065603",
        type: "money-market",
        balance: 10000.0,
        nickname: "Emergency",
      },
    ],
    cards: [
      {
        last4: "5510",
        network: "Visa",
        status: "Active",
        frozenReason: "",
        frozenAt: "",
      },
    ],
  },
]
