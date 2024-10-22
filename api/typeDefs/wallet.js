import { gql } from 'graphql-tag'
import { fieldToGqlArg, generateResolverName, generateTypeDefName } from '@/lib/wallet'

import walletDefs from 'wallets/server'
import { isServerField } from 'wallets'

function injectTypeDefs (typeDefs) {
  const injected = [rawTypeDefs(), mutationTypeDefs()]
  return `${typeDefs}\n\n${injected.join('\n\n')}\n`
}

function mutationTypeDefs () {
  console.group('injected GraphQL mutations:')

  const typeDefs = walletDefs.map((w) => {
    let args = 'id: ID, '
    args += w.fields
      .filter(isServerField)
      .map(fieldToGqlArg).join(', ')
    args += ', settings: AutowithdrawSettings!, priorityOnly: Boolean'
    const resolverName = generateResolverName(w.walletField)
    const typeDef = `${resolverName}(${args}): Boolean`
    console.log(typeDef)
    return typeDef
  })

  console.groupEnd()

  return `extend type Mutation {\n${typeDefs.join('\n')}\n}`
}

function rawTypeDefs () {
  console.group('injected GraphQL type defs:')

  const typeDefs = walletDefs.map((w) => {
    const args = w.fields
      .filter(isServerField)
      .map(fieldToGqlArg)
      .map(s => '  ' + s)
      .join('\n')
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
    numBolt11s: Int!
    connectAddress: String!
    walletHistory(cursor: String, inc: String): History
    wallets: [Wallet!]!
    wallet(id: ID!): Wallet
    walletByType(type: String!): Wallet
    walletLogs(type: String, from: String, to: String, cursor: String): WalletLog!
  }

  extend type Mutation {
    createInvoice(amount: Int!, expireSecs: Int, hodlInvoice: Boolean): Invoice!
    createWithdrawl(invoice: String!, maxFee: Int!): Withdrawl!
    sendToLnAddr(addr: String!, amount: Int!, maxFee: Int!, comment: String, identifier: Boolean, name: String, email: String): Withdrawl!
    cancelInvoice(hash: String!, hmac: String!): Invoice!
    dropBolt11(id: ID): Withdrawl
    removeWallet(id: ID!): Boolean
    deleteWalletLogs(wallet: String): Boolean
  }

  type Wallet {
    id: ID!
    createdAt: Date!
    type: String!
    enabled: Boolean!
    priority: Int!
    wallet: WalletDetails!
  }

  input AutowithdrawSettings {
    autoWithdrawThreshold: Int!
    autoWithdrawMaxFeePercent: Float!
    autoWithdrawMaxFeeTotal: Int!
    priority: Int
    enabled: Boolean
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
    actionState: String
    actionType: String
    actionError: String
    item: Item
    itemAct: ItemAct
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
    p2p: Boolean!
    preimage: String
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
  }
`

export default gql`${injectTypeDefs(typeDefs)}`
