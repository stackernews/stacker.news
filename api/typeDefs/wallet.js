import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    invoice(id: ID!): Invoice!
    withdrawl(id: ID!): Withdrawl!
    numBolt11s: Int!
    connectAddress: String!
    walletHistory(cursor: String, inc: String): History
    wallets: [Wallet!]!
    wallet(id: ID!): Wallet
    walletByType(type: String!): Wallet
  }

  extend type Mutation {
    createInvoice(amount: Int!, expireSecs: Int, hodlInvoice: Boolean): Invoice!
    createWithdrawl(invoice: String!, maxFee: Int!): Withdrawl!
    sendToLnAddr(addr: String!, amount: Int!, maxFee: Int!, comment: String, identifier: Boolean, name: String, email: String): Withdrawl!
    cancelInvoice(hash: String!, hmac: String!): Invoice!
    dropBolt11(id: ID): Withdrawl
    upsertWalletLND(id: ID, socket: String!, macaroon: String!, cert: String, settings: AutowithdrawSettings!): Boolean
    upsertWalletCoreLightning(id: ID, socket: String!, rune: String!, settings: AutowithdrawSettings!): Boolean
    upsertWalletLNAddr(id: ID, address: String!, settings: AutowithdrawSettings!): Boolean
    removeWallet(id: ID!): Boolean
  }

  type Wallet {
    id: ID!
    createdAt: Date!
    type: String!
    priority: Boolean!
    wallet: WalletDetails!
  }

  type WalletLNAddr {
    address: String!
  }

  type WalletLND {
    socket: String!
    macaroon: String!
    cert: String
  }

  union WalletDetails = WalletLNAddr | WalletLND

  input AutowithdrawSettings {
    autoWithdrawThreshold: Int!
    autoWithdrawMaxFeePercent: Float!
    priority: Boolean!
  }

  type Invoice {
    id: ID!
    createdAt: Date!
    hash: String!
    bolt11: String!
    expiresAt: Date!
    cancelled: Boolean!
    confirmedAt: Date
    satsReceived: Int
    satsRequested: Int!
    nostr: JSONObject
    comment: String
    lud18Data: JSONObject
    hmac: String
    isHeld: Boolean
    confirmedPreimage: String
  }

  type Withdrawl {
    id: ID!
    createdAt: Date!
    hash: String
    bolt11: String
    satsPaying: Int!
    satsPaid: Int
    satsFeePaying: Int!
    satsFeePaid: Int
    status: String
    autoWithdraw: Boolean!
  }

  type Fact {
    id: ID!
    createdAt: Date!
    sats: Float!
    type: String!
    bolt11: String
    status: String
    description: String
    autoWithdraw: Boolean
    item: Item
    invoiceComment: String
    invoicePayerData: JSONObject
    subName: String
  }

  type History {
    facts: [Fact!]!
    cursor: String
  }
`
