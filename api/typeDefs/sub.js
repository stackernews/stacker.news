import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    sub(name: ID!): Sub
    subLatestPost(name: ID!): String
  }

  type Sub {
    name: ID!
    createdAt: String!
    updatedAt: String!
    postTypes: [String!]!
    rankingType: String!
    baseCost: Int!
  }
`
