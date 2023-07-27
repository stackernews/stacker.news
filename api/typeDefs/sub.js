import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    sub(name: String): Sub
    subLatestPost(name: String!): String
  }

  type Sub {
    name: String!
    createdAt: Date!
    updatedAt: Date!
    postTypes: [String!]!
    rankingType: String!
    baseCost: Int!
  }
`
