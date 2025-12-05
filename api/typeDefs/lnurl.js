import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    lnAuth(k1: String!): LnAuth!
  }

  extend type Mutation {
    createAuth: LnAuth!
  }

  type LnAuth {
    id: ID!
    createdAt: Date!
    k1: String!
    pubkey: String
    encodedUrl: String!
  }
`
