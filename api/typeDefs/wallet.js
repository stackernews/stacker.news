import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    invoice(id: ID!): Invoice!
    withdrawl(id: ID!): Withdrawl!
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
    msatsPaid: Int
    msatsFeePaying: Int!
    msatsFeePaid: Int
    status: String
  }
`
