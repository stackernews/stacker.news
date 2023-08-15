import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    rewards(when: String): Rewards!
    meRewards(when: String!): MeRewards
  }

  extend type Mutation {
    donateToRewards(sats: Int!): Int!
  }

  type Rewards {
    total: Int!
    time: Date!
    sources: [NameValue!]!
  }

  type Reward {
    type: String
    rank: Int
    sats: Int!
  }

  type MeRewards {
    total: Int!
    rewards: [Reward!]
  }
`
