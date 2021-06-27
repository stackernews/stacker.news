import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    lnAuth(k1: String!): LnAuth!
  }

  extend type Mutation {
    createAuth: LnAuth!
  }

  type LnAuth {
    id: ID!
    createdAt: String!
    k1: String!
    pubkey: String
    encodedUrl: String!
  }
`
