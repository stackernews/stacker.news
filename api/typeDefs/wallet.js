import { gql } from 'graphql-tag'

const shared = 'walletId: ID, templateName: ID, enabled: Boolean!'

const typeDefs = gql`
  extend type Query {
    numBolt11s: Int!
    connectAddress: String!
    wallets: [WalletOrTemplate!]!
    wallet(id: ID, name: String): WalletOrTemplate
    walletSettings: WalletSettings!
    walletLogs(protocolId: Int, cursor: String, debug: Boolean): WalletLogs!
  }

  extend type Mutation {
    createWithdrawl(invoice: String!, maxFee: Int!): PayIn!
    sendToLnAddr(addr: String!, amount: Int!, maxFee: Int!, comment: String, identifier: Boolean, name: String, email: String): PayIn!
    dropBolt11(hash: String!): Boolean
    buyCredits(credits: Int!): PayIn!

    # upserts
    upsertWalletSendLNbits(
      ${shared},
      url: String!,
      apiKey: VaultEntryInput!
    ): WalletSendLNbits!

    upsertWalletRecvLNbits(
      ${shared},
      url: String!,
      apiKey: String!
    ): WalletRecvLNbits!

    upsertWalletSendPhoenixd(
      ${shared},
      url: String!,
      apiKey: VaultEntryInput!
    ): WalletSendPhoenixd!

    upsertWalletRecvPhoenixd(
      ${shared},
      url: String!,
      apiKey: String!
    ): WalletRecvPhoenixd!

    upsertWalletSendBlink(
      ${shared},
      currency: VaultEntryInput!,
      apiKey: VaultEntryInput!
    ): WalletSendBlink!

    upsertWalletSendCLNRest(
      ${shared},
      socket: String!,
      rune: VaultEntryInput!,
    ): WalletSendCLNRest!

    upsertWalletRecvBlink(
      ${shared},
      currency: String!,
      apiKey: String!
    ): WalletRecvBlink!

    upsertWalletRecvLightningAddress(
      ${shared},
      address: String!
    ): WalletRecvLightningAddress!

    upsertWalletSendNWC(
      ${shared},
      url: VaultEntryInput!
    ): WalletSendNWC!

    upsertWalletRecvNWC(
      ${shared},
      url: String!
    ): WalletRecvNWC!

    upsertWalletRecvCLNRest(
      ${shared},
      socket: String!,
      rune: String!,
      cert: String
    ): WalletRecvCLNRest!

    upsertWalletRecvLNDGRPC(
      ${shared},
      socket: String!,
      macaroon: String!,
      cert: String
    ): WalletRecvLNDGRPC!

    upsertWalletSendLNC(
      ${shared},
      pairingPhrase: VaultEntryInput!,
      localKey: VaultEntryInput!,
      remoteKey: VaultEntryInput!,
      serverHost: VaultEntryInput!
    ): WalletSendLNC!

    upsertWalletSendWebLN(
      ${shared}
    ): WalletSendWebLN!

    # tests
    testWalletRecvNWC(
      url: String!
    ): Boolean!

    testWalletRecvLightningAddress(
      address: String!
    ): Boolean!

    testWalletRecvCLNRest(
      socket: String!,
      rune: String!,
      cert: String
    ): Boolean!

    testWalletRecvLNDGRPC(
      socket: String!,
      macaroon: String!,
      cert: String
    ): Boolean!

    testWalletRecvPhoenixd(
      url: String!
      apiKey: String!
    ): Boolean!

    testWalletRecvLNbits(
      url: String!
      apiKey: String!
    ): Boolean!

    testWalletRecvBlink(
      currency: String!
      apiKey: String!
    ): Boolean!

    # delete
    deleteWallet(id: ID!): Boolean

    # crypto
    updateWalletEncryption(keyHash: String!, wallets: [WalletEncryptionUpdate!]!): Boolean
    updateKeyHash(keyHash: String!): Boolean
    resetWallets(newKeyHash: String!): Boolean
    disablePassphraseExport: Boolean

    # settings
    setWalletSettings(settings: WalletSettingsInput!): WalletSettings!
    setWalletPriorities(priorities: [WalletPriorityUpdate!]!): Boolean

    # logs
    addWalletLog(protocolId: Int, level: String!, message: String!, timestamp: Date!): Boolean
    deleteWalletLogs(protocolId: Int, debug: Boolean): Boolean
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
    | WalletSendCLNRest
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

  type WalletSendCLNRest {
    id: ID!
    socket: String!
    rune: VaultEntry!
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
