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
      replyCost: Int!,
      postTypes: [String!]!,
      billingType: String!, billingAutoRenew: Boolean!,
      moderated: Boolean!, nsfw: Boolean!): SubPaidAction!
    paySub(name: String!): SubPaidAction!
    toggleMuteSub(name: String!): Boolean!
    toggleSubSubscription(name: String!): Boolean!
    transferTerritory(subName: String!, userName: String!): Sub
    unarchiveTerritory(name: String!, desc: String, baseCost: Int!,
      replyCost: Int!, postTypes: [String!]!,
      billingType: String!, billingAutoRenew: Boolean!,
      moderated: Boolean!, nsfw: Boolean!): SubPaidAction!
  }

  type Sub {
    name: String!
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
    replyCost: Int!
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
