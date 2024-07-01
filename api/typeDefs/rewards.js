import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    rewards(when: [String!]): [Rewards!]
    meRewards(when: [String!]!): [MeRewards]
  }

  extend type Mutation {
    donateToRewards(sats: Int!, hash: String, hmac: String): DonatePaidAction!
  }

  type DonateResult {
    sats: Int
  }

  type Rewards {
    total: Int!
    time: Date!
    sources: [NameValue!]!
    leaderboard: UsersNullable
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
