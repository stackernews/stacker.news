import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    invoice(id: ID!): Invoice!
    withdrawl(id: ID!): Withdrawl!
    connectAddress: String!
    walletHistory(cursor: String, inc: String): History
  }

  extend type Mutation {
    createInvoice(amount: Int!, expireSecs: Int): Invoice!
    createWithdrawl(invoice: String!, maxFee: Int!): Withdrawl!
    sendToLnAddr(addr: String!, amount: Int!, maxFee: Int!): Withdrawl!
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
    hmac: String
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
  }

  type History {
    facts: [Fact!]!
    cursor: String
  }
`
