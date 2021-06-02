import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    invoice(id: ID!): Invoice!
    withdrawl(id: ID!): Withdrawl!
    connectAddress: String!
  }

  extend type Mutation {
    createInvoice(amount: Int!): Invoice!
    createWithdrawl(invoice: String!, maxFee: Int!): Withdrawl!
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
`
