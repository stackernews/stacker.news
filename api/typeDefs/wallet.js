import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    invoice(id: ID!): String!
  }

  extend type Mutation {
    createInvoice(amount: Int!): String!
  }
`
