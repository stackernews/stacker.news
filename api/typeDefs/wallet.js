import { gql } from 'graphql-tag'
import { generateResolverName } from '@/lib/wallet'

import walletDefs from 'wallets/server'

function injectTypeDefs (typeDefs) {
  console.group('injected GraphQL type defs:')
  const injected = walletDefs.map(
    (w) => {
      let args = 'id: ID, '
      args += w.fields.map(f => {
        let arg = `${f.name}: String`
        if (!f.optional) {
          arg += '!'
        }
        return arg
      }).join(', ')
      args += ', settings: AutowithdrawSettings!'
      const resolverName = generateResolverName(w.walletField)
      const typeDef = `${resolverName}(${args}): Boolean`
      console.log(typeDef)
      return typeDef
    })
  console.groupEnd()

  return `${typeDefs}\n\nextend type Mutation {\n${injected.join('\n')}\n}`
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
    walletLogs: [WalletLog]!
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

  type WalletLNAddr {
    address: String!
  }

  type WalletLND {
    socket: String!
    macaroon: String!
    cert: String
  }

  type WalletCLN {
    socket: String!
    rune: String!
    cert: String
  }

  union WalletDetails = WalletLNAddr | WalletLND | WalletCLN

  input AutowithdrawSettings {
    autoWithdrawThreshold: Int!
    autoWithdrawMaxFeePercent: Float!
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
    id: ID!
    createdAt: Date!
    wallet: ID!
    level: String!
    message: String!
  }
`

export default gql`${injectTypeDefs(typeDefs)}`
