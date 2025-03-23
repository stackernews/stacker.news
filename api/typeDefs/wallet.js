import { gql } from 'graphql-tag'
import { fieldToGqlArg, fieldToGqlArgOptional, generateResolverName, generateTypeDefName } from '@/wallets/graphql'
import { isServerField } from '@/wallets/common'
import walletDefs from '@/wallets/server'

function injectTypeDefs (typeDefs) {
  const injected = [rawTypeDefs(), mutationTypeDefs()]
  return `${typeDefs}\n\n${injected.join('\n\n')}\n`
}

function mutationTypeDefs () {
  console.group('injected GraphQL mutations:')

  const typeDefs = walletDefs.map((w) => {
    let args = 'id: ID, '
    const serverFields = w.fields
      .filter(isServerField)
      .map(fieldToGqlArgOptional)
    if (serverFields.length > 0) args += serverFields.join(', ') + ','
    args += 'enabled: Boolean, priority: Int, vaultEntries: [VaultEntryInput!], settings: AutowithdrawSettings, validateLightning: Boolean'
    const resolverName = generateResolverName(w.walletField)
    const typeDef = `${resolverName}(${args}): Wallet`
    console.log(typeDef)
    return typeDef
  })

  console.groupEnd()

  return `extend type Mutation {\n${typeDefs.join('\n')}\n}`
}

function rawTypeDefs () {
  console.group('injected GraphQL type defs:')

  const typeDefs = walletDefs.map((w) => {
    let args = w.fields
      .filter(isServerField)
      .map(fieldToGqlArg)
      .map(s => '  ' + s)
      .join('\n')
    if (!args) {
      // add a placeholder arg so the type is not empty
      args = '  _empty: Boolean'
    }
    const typeDefName = generateTypeDefName(w.walletType)
    const typeDef = `type ${typeDefName} {\n${args}\n}`
    console.log(typeDef)
    return typeDef
  })

  let union = 'union WalletDetails = '
  union += walletDefs.map((w) => {
    const typeDefName = generateTypeDefName(w.walletType)
    return typeDefName
  }).join(' | ')
  console.log(union)

  console.groupEnd()

  return typeDefs.join('\n\n') + union
}

const typeDefs = `
  extend type Query {
    invoice(id: ID!): Invoice!
    withdrawl(id: ID!): Withdrawl!
    direct(id: ID!): Direct!
    numBolt11s: Int!
    connectAddress: String!
    walletHistory(cursor: String, inc: String): History
    wallets(includeReceivers: Boolean, includeSenders: Boolean, onlyEnabled: Boolean, prioritySort: String): [Wallet!]!
    wallet(id: ID!): Wallet
    walletByType(type: String!): Wallet
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
  }

  type BuyCreditsResult {
    credits: Int!
  }

  interface InvoiceOrDirect {
    id: ID!
  }

  type Wallet {
    id: ID!
    createdAt: Date!
    updatedAt: Date!
    type: String!
    enabled: Boolean!
    priority: Int!
    wallet: WalletDetails!
    vaultEntries: [VaultEntry!]!
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
    wallet: ID!
    level: String!
    message: String!
    context: JSONObject
  }
`

export default gql`${injectTypeDefs(typeDefs)}`
