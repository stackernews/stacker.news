import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    invoice(id: ID!): Invoice!
    withdrawl(id: ID!): Withdrawl!
    connectAddress: String!
    walletHistory(cursor: String, inc: String): History
  }

  extend type Mutation {
    createInvoice(amount: Int!, expireSecs: Int, hodlInvoice: Boolean): Invoice!
    createWithdrawl(invoice: String!, maxFee: Int!): Withdrawl!
    sendToLnAddr(addr: String!, amount: Int!, maxFee: Int!, comment: String, identifier: Boolean, name: String, email: String): Withdrawl!
    cancelInvoice(hash: String!, hmac: String!): Invoice!
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
  }

  type Withdrawl {
    id: ID!
    createdAt: Date!
    hash: String!
    bolt11: String!
    satsPaying: Int!
    satsPaid: Int
    satsFeePaying: Int!
    satsFeePaid: Int
    status: String
  }

  type Fact {
    id: ID!
    factId: ID!
    bolt11: String
    createdAt: Date!
    sats: Float!
    satsFee: Float
    status: String
    type: String!
    description: String
    item: Item
    invoiceComment: String
    invoicePayerData: JSONObject
  }

  type History {
    facts: [Fact!]!
    cursor: String
  }
`
