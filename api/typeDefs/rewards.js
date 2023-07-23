import { gql } from 'apollo-server-micro'

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
