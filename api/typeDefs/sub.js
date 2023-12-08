import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    sub(name: String): Sub
    subLatestPost(name: String!): String
    subs: [Sub!]!
  }

  extend type Mutation {
    upsertSub(name: String!, desc: String, baseCost: Int!,
      postTypes: [String!]!, billingType: String!, billingAutoRenew: Boolean!,
       hash: String, hmac: String): Sub
    paySub(name: String!, hash: String, hmac: String): Sub
  }

  type Sub {
    name: ID!
    createdAt: Date!
    userId: Int!
    user: User!
    desc: String
    updatedAt: Date!
    postTypes: [String!]!
    billingCost: Int!
    billingType: String!
    billingAutoRenew: Boolean!
    rankingType: String!
    billedLastAt: Date!
    baseCost: Int!
    status: String!
  }
`
