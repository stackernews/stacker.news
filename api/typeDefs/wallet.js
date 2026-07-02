import { gql } from 'graphql-tag'

const typeDefs = gql`
  extend type Query {
    numBolt11s: Int!
    connectAddress: String!
    wallets: [WalletOrTemplate!]!
    walletSettings: WalletSettings!
    walletLogs(walletId: ID, payInId: Int, externalTransactionId: Int, cursor: String): WalletLogs!
    externalTransaction(id: Int!): ExternalTransaction
  }

  extend type Mutation {
    createWithdrawl(invoice: String!, maxFee: Int!): PayIn!
    createWalletInvoice(walletId: ID!, amount: Int!, description: String): WalletExternalInvoice!
    sendToLnAddr(addr: String!, amount: Int!, maxFee: Int!, comment: String, identifier: Boolean, name: String, email: String): PayIn!
    dropBolt11(hash: String!): Boolean
    buyCredits(credits: Int!, sendProtocolId: Int): PayIn!
    createExternalTransaction(input: ExternalTransactionCreateInput!): ExternalTransaction!
    updateExternalTransaction(input: ExternalTransactionUpdateInput!): ExternalTransaction!

    # test a receive protocol by asking it to mint a probe invoice
    testWalletRecvProtocol(config: WalletRecvProtocolTestInput!): Boolean!

    # delete
    deleteWallet(id: ID!): Boolean

    # atomic configure-save
    saveWalletProtocols(
      walletId: ID,
      templateName: ID,
      upserts: [WalletProtocolUpsertInput!]!,
      removeIds: [ID!]!
    ): Wallet

    # crypto
    updateWalletEncryption(keyHash: String!, wallets: [WalletEncryptionUpdate!]!): Boolean
    updateKeyHash(keyHash: String!): Boolean
    resetWallets(newKeyHash: String!): Boolean
    disablePassphraseExport: Boolean

    # settings
    setWalletSettings(settings: WalletSettingsInput!): WalletSettings!
    setWalletPriorities(priorities: [WalletPriorityUpdate!]!): Boolean

    # logs
    addWalletLog(protocolId: Int, level: WalletLogLevel!, message: String!, timestamp: Date!, payInId: Int, externalTransactionId: Int, updateStatus: Boolean): Boolean
    deleteWalletLogs(walletId: ID): Boolean
  }

  union WalletOrTemplate = Wallet | WalletTemplate
  union WalletActivityItem = PayIn | ExternalTransaction

  enum ExternalTransactionDirection {
    SEND
    RECEIVE
  }

  enum ExternalTransactionSettlementStatus {
    PENDING
    SETTLED
    FAILED
    UNKNOWN
  }

  enum ExternalTransactionSourceType {
    BOLT11
    LN_ADDR
  }

  enum ExternalTransactionUnknownReason {
    TRANSIENT_CHECK_FAILED
    PERMISSION_REQUIRED
    VERIFICATION_UNSUPPORTED
    PROOF_UNAVAILABLE
    STATUS_UNAVAILABLE
  }

  type ExternalTransaction {
    id: Int!
    createdAt: Date!
    updatedAt: Date!
    direction: ExternalTransactionDirection!
    settlementStatus: ExternalTransactionSettlementStatus!
    settlementStatusChangedAt: Date!
    userId: Int!
    walletId: Int!
    protocolId: Int!
    bolt11: String
    hash: String
    preimage: String
    amountMsats: BigInt
    feeMsats: BigInt
    maxFeeLimitMsats: BigInt
    invoiceExpiresAt: Date
    settledAt: Date
    error: String
    unknownReason: ExternalTransactionUnknownReason
    sourceType: ExternalTransactionSourceType
    sourceValue: String
    verificationContext: JSONObject
    walletInfo: PayInWalletInfo
  }

  input ExternalTransactionCreateInput {
    walletId: ID!
    protocolId: Int!
    bolt11: String!
    sourceType: ExternalTransactionSourceType
    sourceValue: String
    maxFeeLimitMsats: BigInt
    duplicateConfirmed: Boolean
  }

  input ExternalTransactionUpdateInput {
    id: Int!
    settlementStatus: ExternalTransactionSettlementStatus
    preimage: String
    feeMsats: BigInt
    settledAt: Date
    error: String
    unknownReason: ExternalTransactionUnknownReason
  }

  enum WalletStatus {
    OK
    WARNING
    ERROR
    DISABLED
  }

  enum WalletLogLevel {
    OK
    INFO
    WARNING
    ERROR
    DEBUG
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

  type WalletExternalInvoice {
    bolt11: String!
    transaction: ExternalTransaction
  }

  union WalletProtocolConfig =
    | WalletSendNWC
    | WalletSendLNbits
    | WalletSendPhoenixd
    | WalletSendBlink
    | WalletSendWebLN
    | WalletSendLNC
    | WalletSendCLNRest
    | WalletSendClink
    | WalletRecvNWC
    | WalletRecvLNbits
    | WalletRecvPhoenixd
    | WalletRecvBlink
    | WalletRecvLightningAddress
    | WalletRecvCLNRest
    | WalletRecvLNDGRPC
    | WalletRecvClink

  type WalletSettings {
    receiveCreditsBelowSats: Int!
    sendCreditsBelowSats: Int!
    autoWithdrawThreshold: Int
    autoWithdrawMaxFeePercent: Float
    autoWithdrawMaxFeeTotal: Int
  }

  input WalletSettingsInput {
    receiveCreditsBelowSats: Int!
    sendCreditsBelowSats: Int!
    autoWithdrawThreshold: Int!
    autoWithdrawMaxFeePercent: Float!
    autoWithdrawMaxFeeTotal: Int!
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

  type WalletSendCLNRest {
    id: ID!
    socket: String!
    rune: VaultEntry!
  }

  type WalletSendClink {
    id: ID!
    ndebit: VaultEntry!
    secretKey: VaultEntry!
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

  type WalletRecvClink {
    id: ID!
    noffer: String!
  }

  input AutowithdrawSettings {
    autoWithdrawThreshold: Int!
    autoWithdrawMaxFeePercent: Float!
    autoWithdrawMaxFeeTotal: Int!
  }

  input WalletEncryptionUpdate {
    id: ID!
    protocols: [WalletProtocolConfigInput!]!
  }

  input WalletPriorityUpdate {
    id: ID!
    priority: Int!
  }

  input WalletProtocolUpsertInput {
    enabled: Boolean!
    config: WalletProtocolConfigInput!
  }

  # Discriminated config input for a single wallet protocol. Exactly one branch
  # must be set; @oneOf enforces this at variable validation time and the branch
  # name identifies which protocol the resolver is saving or rotating.
  input WalletProtocolConfigInput @oneOf {
    walletSendNWC: WalletSendNWCConfigInput
    walletRecvNWC: WalletRecvNWCConfigInput
    walletSendLNbits: WalletSendLNbitsConfigInput
    walletRecvLNbits: WalletRecvLNbitsConfigInput
    walletSendPhoenixd: WalletSendPhoenixdConfigInput
    walletRecvPhoenixd: WalletRecvPhoenixdConfigInput
    walletSendBlink: WalletSendBlinkConfigInput
    walletRecvBlink: WalletRecvBlinkConfigInput
    walletSendLNC: WalletSendLNCConfigInput
    walletSendCLNRest: WalletSendCLNRestConfigInput
    walletRecvCLNRest: WalletRecvCLNRestConfigInput
    walletRecvLNDGRPC: WalletRecvLNDGRPCConfigInput
    walletRecvLightningAddress: WalletRecvLightningAddressConfigInput
    walletSendClink: WalletSendClinkConfigInput
    walletRecvClink: WalletRecvClinkConfigInput
    # WebLN has no fields; the boolean is a sentinel and must be true.
    walletSendWebLN: Boolean
  }

  # Discriminated input for the receive-protocol probe mutation. Reuses the
  # save-side recv config inputs since the recv configs are plaintext and
  # already match the fields the test resolver needs.
  input WalletRecvProtocolTestInput @oneOf {
    walletRecvNWC: WalletRecvNWCConfigInput
    walletRecvLNbits: WalletRecvLNbitsConfigInput
    walletRecvPhoenixd: WalletRecvPhoenixdConfigInput
    walletRecvBlink: WalletRecvBlinkConfigInput
    walletRecvLightningAddress: WalletRecvLightningAddressConfigInput
    walletRecvCLNRest: WalletRecvCLNRestConfigInput
    walletRecvLNDGRPC: WalletRecvLNDGRPCConfigInput
    walletRecvClink: WalletRecvClinkConfigInput
  }

  input WalletSendNWCConfigInput { url: VaultEntryInput! }
  input WalletRecvNWCConfigInput { url: String! }
  input WalletSendLNbitsConfigInput { url: String!, apiKey: VaultEntryInput! }
  input WalletRecvLNbitsConfigInput { url: String!, apiKey: String! }
  input WalletSendPhoenixdConfigInput { url: String!, apiKey: VaultEntryInput! }
  input WalletRecvPhoenixdConfigInput { url: String!, apiKey: String! }
  input WalletSendBlinkConfigInput { currency: VaultEntryInput!, apiKey: VaultEntryInput! }
  input WalletRecvBlinkConfigInput { currency: String!, apiKey: String! }
  input WalletSendLNCConfigInput {
    pairingPhrase: VaultEntryInput!
    localKey: VaultEntryInput!
    remoteKey: VaultEntryInput!
    serverHost: VaultEntryInput!
  }
  input WalletSendCLNRestConfigInput { socket: String!, rune: VaultEntryInput! }
  input WalletRecvCLNRestConfigInput { socket: String!, rune: String!, cert: String }
  input WalletRecvLNDGRPCConfigInput { socket: String!, macaroon: String!, cert: String }
  input WalletRecvLightningAddressConfigInput { address: String! }
  input WalletSendClinkConfigInput { ndebit: VaultEntryInput!, secretKey: VaultEntryInput! }
  input WalletRecvClinkConfigInput { noffer: String! }

  type WalletLogs {
    logs: [WalletLogEntry!]!
    cursor: String
  }

  type WalletLogEntry {
    id: ID!
    createdAt: Date!
    wallet: Wallet
    protocol: WalletProtocol
    level: WalletLogLevel!
    message: String!
    context: JSONObject
    externalTransactionId: Int
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
