import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    invoice(id: ID!): Invoice!
  }

  extend type Mutation {
    createInvoice(amount: Int!): Invoice!
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
`
