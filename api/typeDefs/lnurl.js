import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    lnAuth(k1: String!): LnAuth!
    lnWith(k1: String!): LnWith!
  }

  extend type Mutation {
    createAuth: LnAuth!
    createWith: LnWith!
  }

  type LnAuth {
    id: ID!
    createdAt: String!
    k1: String!
    pubkey: String
    encodedUrl: String!
    slashtagUrl: String!
  }

  type LnWith {
    id: ID!
    createdAt: String!
    k1: String!
    user: User!
    withdrawalId: Int
    encodedUrl: String!
  }
`
