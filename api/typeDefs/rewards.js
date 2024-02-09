import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    rewards(when: [String!]): [Rewards!]
    meRewards(when: [String!]!): [MeRewards]
  }

  extend type Mutation {
    donateToRewards(sats: Int!, hash: String, hmac: String): Int!
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
    item: Item
  }

  type MeRewards {
    total: Int!
    rewards: [Reward!]
  }
`
