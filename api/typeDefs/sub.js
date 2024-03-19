import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    sub(name: String): Sub
    subLatestPost(name: String!): String
    subs: [Sub!]!
    topSubs(cursor: String, when: String, from: String, to: String, by: String, limit: Limit): Subs
    userSubs(name: String!, cursor: String, when: String, from: String, to: String, by: String, limit: Limit): Subs
  }

  type Subs {
    cursor: String
    subs: [Sub!]!
  }

  extend type Mutation {
    upsertSub(oldName: String, name: String!, desc: String, baseCost: Int!,
      postTypes: [String!]!, allowFreebies: Boolean!,
      billingType: String!, billingAutoRenew: Boolean!,
      moderated: Boolean!, hash: String, hmac: String, nsfw: Boolean!): Sub
    paySub(name: String!, hash: String, hmac: String): Sub
    toggleMuteSub(name: String!): Boolean!
    toggleSubSubscription(name: String!): Boolean!
    transferTerritory(subName: String!, userName: String!): Sub
    unarchiveTerritory(name: String!, desc: String, baseCost: Int!,
      postTypes: [String!]!, allowFreebies: Boolean!,
      billingType: String!, billingAutoRenew: Boolean!,
      moderated: Boolean!, hash: String, hmac: String, nsfw: Boolean!): Sub
  }

  type Sub {
    name: ID!
    createdAt: Date!
    userId: Int!
    user: User!
    desc: String
    updatedAt: Date!
    postTypes: [String!]!
    allowFreebies: Boolean!
    billingCost: Int!
    billingType: String!
    billingAutoRenew: Boolean!
    rankingType: String!
    billedLastAt: Date!
    billPaidUntil: Date
    baseCost: Int!
    status: String!
    moderated: Boolean!
    moderatedCount: Int!
    meMuteSub: Boolean!
    nsfw: Boolean!
    nposts(when: String, from: String, to: String): Int!
    ncomments(when: String, from: String, to: String): Int!
    meSubscription: Boolean!

    optional: SubOptional!
  }

  type SubOptional {
    """
    conditionally private
    """
    stacked(when: String, from: String, to: String): Int
    spent(when: String, from: String, to: String): Int
    revenue(when: String, from: String, to: String): Int
  }
`
