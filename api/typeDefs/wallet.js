import { gql } from 'graphql-tag'

const sharedSend = 'walletId: ID, templateName: ID, enabled: Boolean!'

const sharedRecv = `${sharedSend}, networkTests: Boolean`

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
    walletSettings: WalletSettings!
    walletLogs(protocolId: Int, cursor: String, debug: Boolean): WalletLogs!
    failedInvoices: [Invoice!]!
  }

  extend type Mutation {
    createWithdrawl(invoice: String!, maxFee: Int!): Withdrawl!
    sendToLnAddr(addr: String!, amount: Int!, maxFee: Int!, comment: String, identifier: Boolean, name: String, email: String): Withdrawl!
    cancelInvoice(hash: String!, hmac: String, userCancel: Boolean): Invoice!
    dropBolt11(hash: String!): Boolean
    removeWallet(id: ID!): Boolean
    deleteWalletLogs(protocolId: Int, debug: Boolean): Boolean
    setWalletPriorities(priorities: [WalletPriorityUpdate!]!): Boolean
    buyCredits(credits: Int!): BuyCreditsPaidAction!

    upsertWalletSendLNbits(
      ${sharedSend},
      url: String!,
      apiKey: VaultEntryInput!
    ): WalletSendLNbits!

    upsertWalletRecvLNbits(
      ${sharedRecv},
      url: String!,
      apiKey: String!
    ): WalletRecvLNbits!

    upsertWalletSendPhoenixd(
      ${sharedSend},
      url: String!,
      apiKey: VaultEntryInput!
    ): WalletSendPhoenixd!

    upsertWalletRecvPhoenixd(
      ${sharedRecv},
      url: String!,
      apiKey: String!
    ): WalletRecvPhoenixd!

    upsertWalletSendBlink(
      ${sharedSend},
      currency: VaultEntryInput!,
      apiKey: VaultEntryInput!
    ): WalletSendBlink!

    upsertWalletRecvBlink(
      ${sharedRecv},
      currency: String!,
      apiKey: String!
    ): WalletRecvBlink!

    upsertWalletRecvLightningAddress(
      ${sharedRecv},
      address: String!
    ): WalletRecvLightningAddress!

    upsertWalletSendNWC(
      ${sharedSend},
      url: VaultEntryInput!
    ): WalletSendNWC!

    upsertWalletRecvNWC(
      ${sharedRecv},
      url: String!
    ): WalletRecvNWC!

    upsertWalletRecvCLNRest(
      ${sharedRecv},
      socket: String!,
      rune: String!,
      cert: String
    ): WalletRecvCLNRest!

    upsertWalletRecvLNDGRPC(
      ${sharedRecv},
      socket: String!,
      macaroon: String!,
      cert: String
    ): WalletRecvLNDGRPC!

    upsertWalletSendLNC(
      ${sharedSend},
      pairingPhrase: VaultEntryInput!,
      localKey: VaultEntryInput!,
      remoteKey: VaultEntryInput!,
      serverHost: VaultEntryInput!
    ): WalletSendLNC!

    upsertWalletSendWebLN(
      ${sharedSend}
    ): WalletSendWebLN!

    removeWalletProtocol(id: ID!): Boolean
    updateWalletEncryption(keyHash: String!, wallets: [WalletEncryptionUpdate!]!): Boolean
    updateKeyHash(keyHash: String!): Boolean
    resetWallets(newKeyHash: String!): Boolean
    disablePassphraseExport: Boolean
    setWalletSettings(settings: WalletSettingsInput!): Boolean
    addWalletLog(protocolId: Int, level: String!, message: String!, timestamp: Date!, invoiceId: Int): Boolean
  }

  type BuyCreditsResult {
    credits: Int!
  }

  interface InvoiceOrDirect {
    id: ID!
  }

  union WalletOrTemplate = Wallet | WalletTemplate

  enum WalletStatus {
    OK
    WARNING
    ERROR
    DISABLED
  }

  type Wallet {
    id: ID!
    name: String!
    priority: Int!
    template: WalletTemplate!
    protocols: [WalletProtocol!]!
    send: WalletStatus!
    receive: WalletStatus!
  }

  type WalletTemplate {
    name: ID!
    protocols: [WalletProtocolTemplate!]!
    send: WalletStatus!
    receive: WalletStatus!
  }

  type WalletProtocol {
    id: ID!
    name: String!
    send: Boolean!
    enabled: Boolean!
    config: WalletProtocolConfig!
    status: WalletStatus!
  }

  type WalletProtocolTemplate {
    id: ID!
    name: String!
    send: Boolean!
  }

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

  type WalletSettings {
    receiveCreditsBelowSats: Int!
    sendCreditsBelowSats: Int!
    autoWithdrawThreshold: Int
    autoWithdrawMaxFeePercent: Float
    autoWithdrawMaxFeeTotal: Int
    proxyReceive: Boolean!
  }

  input WalletSettingsInput {
    receiveCreditsBelowSats: Int!
    sendCreditsBelowSats: Int!
    autoWithdrawThreshold: Int!
    autoWithdrawMaxFeePercent: Float!
    autoWithdrawMaxFeeTotal: Int!
    proxyReceive: Boolean!
  }

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

  input WalletEncryptionUpdate {
    id: ID!
    protocols: [WalletEncryptionUpdateProtocol!]!
  }

  input WalletEncryptionUpdateProtocol {
    name: String!
    send: Boolean!
    config: JSONObject!
  }

  input WalletPriorityUpdate {
    id: ID!
    priority: Int!
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

  type WalletLogs {
    entries: [WalletLogEntry!]!
    cursor: String
  }

  type WalletLogEntry {
    id: ID!
    createdAt: Date!
    wallet: Wallet
    protocol: WalletProtocol
    level: String!
    message: String!
    context: JSONObject
  }

  type VaultEntry {
    id: ID!
    iv: String!
    value: String!
    createdAt: Date!
    updatedAt: Date!
  }

  input VaultEntryInput {
    iv: String!
    value: String!
    keyHash: String!
  }
`
export default typeDefs
