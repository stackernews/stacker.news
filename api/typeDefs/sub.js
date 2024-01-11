import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    sub(name: String): Sub
    subLatestPost(name: String!): String
    subs: [Sub!]!
  }

  extend type Mutation {
    upsertSub(oldName: String, name: String!, desc: String, baseCost: Int!,
      postTypes: [String!]!, allowFreebies: Boolean!,
      billingType: String!, billingAutoRenew: Boolean!,
      moderated: Boolean!, hash: String, hmac: String): Sub
    paySub(name: String!, hash: String, hmac: String): Sub
    toggleMuteSub(name: String!): Boolean!
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
    baseCost: Int!
    status: String!
    moderated: Boolean!
    moderatedCount: Int!
    meMuteSub: Boolean!
  }
`
