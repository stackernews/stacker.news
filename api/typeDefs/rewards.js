import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    expectedRewards: ExpectedRewards!
  }

  extend type Mutation {
    donateToRewards(sats: Int!): Int!
  }

  type ExpectedRewards {
    total: Int!
    sources: [NameValue!]!
  }
`
