import { gql } from 'graphql-tag'

const typeDefs = gql`
  extend type Query {
    invoice(id: ID!): Invoice!
    withdrawl(id: ID!): Withdrawl!
    direct(id: ID!): Direct!
    numBolt11s: Int!
    connectAddress: String!
    walletHistory(cursor: String, inc: String): History
    wallets: [WalletOrTemplate!]!
    wallet(id: ID, name: String): WalletOrTemplate
    walletLogs(type: String, from: String, to: String, cursor: String): WalletLog!
    failedInvoices: [Invoice!]!
  }

  extend type Mutation {
    createInvoice(amount: Int!): InvoiceOrDirect!
    createWithdrawl(invoice: String!, maxFee: Int!): Withdrawl!
    sendToLnAddr(addr: String!, amount: Int!, maxFee: Int!, comment: String, identifier: Boolean, name: String, email: String): Withdrawl!
    cancelInvoice(hash: String!, hmac: String, userCancel: Boolean): Invoice!
    dropBolt11(hash: String!): Boolean
    removeWallet(id: ID!): Boolean
    deleteWalletLogs(wallet: String): Boolean
    setWalletPriority(id: ID!, priority: Int!): Boolean
    buyCredits(credits: Int!): BuyCreditsPaidAction!
    # TODO(wallet-v2): generate these mutations
    upsertWalletSendLNbits(walletId: ID, templateId: ID, url: String!, apiKey: VaultEntryInput!): WalletSendLNbits!
    upsertWalletRecvLNbits(walletId: ID, templateId: ID, url: String!, apiKey: String!): WalletRecvLNbits!
  }

  type BuyCreditsResult {
    credits: Int!
  }

  interface InvoiceOrDirect {
    id: ID!
  }

  union WalletOrTemplate = UserWallet | WalletTemplate

  type UserWallet {
    id: ID!
    name: String!
    enabled: Boolean!
    priority: Int!
    template: WalletTemplate!
    protocols: [WalletProtocol!]!
    send: Boolean!
    receive: Boolean!
  }

  type WalletTemplate {
    id: ID!
    name: String!
    protocols: [WalletProtocolTemplate!]!
    send: Boolean!
    receive: Boolean!
  }

  type WalletProtocol {
    id: ID!
    name: String!
    send: Boolean!
    config: WalletProtocolConfig!
  }

  type WalletProtocolTemplate {
    id: ID!
    name: String!
    send: Boolean!
  }

  # TODO(wallet-v2): This is the list of protocol tables. I want to generate this union type during the build. Should I extract the tables names from the prisma schema?
  union WalletProtocolConfig =
    | WalletSendNWC
    | WalletSendLNbits
    | WalletSendPhoenixd
    | WalletSendBlink
    | WalletSendWebLN
    | WalletSendLNC
    | WalletRecvNWC
    | WalletRecvLNbits
    | WalletRecvPhoenixd
    | WalletRecvBlink
    | WalletRecvLightningAddress
    | WalletRecvCLNRest
    | WalletRecvLNDGRPC

  type WalletSendNWC {
    id: ID!
    url: VaultEntry!
  }

  type WalletSendLNbits {
    id: ID!
    url: String!
    apiKey: VaultEntry!
  }

  type WalletSendPhoenixd {
    id: ID!
    url: String!
    apiKey: VaultEntry!
  }

  type WalletSendBlink {
    id: ID!
    currency: VaultEntry!
    apiKey: VaultEntry!
  }

  type WalletSendWebLN {
    id: ID!
  }

  type WalletSendLNC {
    id: ID!
    pairingPhrase: VaultEntry!
    localKey: VaultEntry!
    remoteKey: VaultEntry!
    serverHost: VaultEntry!
  }

  type WalletRecvNWC {
    id: ID!
    url: String!
  }

  type WalletRecvLNbits {
    id: ID!
    url: String!
    apiKey: String!
  }

  type WalletRecvPhoenixd {
    id: ID!
    url: String!
    apiKey: String!
  }

  type WalletRecvBlink {
    id: ID!
    currency: String!
    apiKey: String!
  }

  type WalletRecvLightningAddress {
    id: ID!
    address: String!
  }

  type WalletRecvCLNRest {
    id: ID!
    socket: String!
    rune: String!
    cert: String
  }

  type WalletRecvLNDGRPC {
    id: ID!
    socket: String!
    macaroon: String!
    cert: String
  }

  input AutowithdrawSettings {
    autoWithdrawThreshold: Int!
    autoWithdrawMaxFeePercent: Float!
    autoWithdrawMaxFeeTotal: Int!
  }

  type Invoice implements InvoiceOrDirect {
    id: ID!
    createdAt: Date!
    hash: String!
    bolt11: String!
    expiresAt: Date!
    cancelled: Boolean!
    cancelledAt: Date
    confirmedAt: Date
    satsReceived: Int
    satsRequested: Int!
    nostr: JSONObject
    comment: String
    lud18Data: JSONObject
    hmac: String
    isHeld: Boolean
    confirmedPreimage: String
    actionState: String
    actionType: String
    actionError: String
    invoiceForward: Boolean
    item: Item
    itemAct: ItemAct
    forwardedSats: Int
    forwardStatus: String
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
    preimage: String
    forwardedActionType: String
  }

  type Direct implements InvoiceOrDirect {
    id: ID!
    createdAt: Date!
    bolt11: String
    hash: String
    sats: Int
    preimage: String
    nostr: JSONObject
    comment: String
    lud18Data: JSONObject
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

  type WalletLog {
    entries: [WalletLogEntry!]!
    cursor: String
  }

  type WalletLogEntry {
    id: ID!
    createdAt: Date!
    wallet: ID
    level: String!
    message: String!
    context: JSONObject
  }
`
export default typeDefs
