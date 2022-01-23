import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    invoice(id: ID!): Invoice!
    withdrawl(id: ID!): Withdrawl!
    connectAddress: String!
    walletHistory(cursor: String, inc: String): History
  }

  extend type Mutation {
    createInvoice(amount: Int!): Invoice!
    createWithdrawl(invoice: String!, maxFee: Int!): Withdrawl!
    sendToLnAddr(addr: String!, amount: Int!, maxFee: Int!): Withdrawl!
  }

  type LnAddrResp {
    callback: String!
    maxSendable: String!
    minSendable: String!
  }

  type Invoice {
    id: ID!
    createdAt: String!
    bolt11: String!
    expiresAt: String!
    cancelled: Boolean!
    confirmedAt: String
    msatsReceived: Int
  }

  type Withdrawl {
    id: ID!
    createdAt: String!
    hash: String!
    bolt11: String!
    msatsPaying: Int!
    satsPaying: Int!
    msatsPaid: Int
    satsPaid: Int
    msatsFeePaying: Int!
    satsFeePaying: Int!
    msatsFeePaid: Int
    satsFeePaid: Int
    status: String
  }

  type Fact {
    id: ID!
    factId: ID!
    bolt11: String
    createdAt: String!
    msats: Int!
    msatsFee: Int
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
