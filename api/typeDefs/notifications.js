import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    notifications(cursor: String, inc: String): Notifications
  }

  extend type Mutation {
    savePushSubscription(endpoint: String!, p256dh: String!, auth: String!, oldEndpoint: String): PushSubscription
    deletePushSubscription(endpoint: String!): PushSubscription
  }

  type Votification {
    id: ID!
    earnedSats: Int!
    item: Item!
    sortTime: String!
  }

  type Reply {
    id: ID!
    item: Item!
    sortTime: String!
  }

  type Mention {
    id: ID!
    mention: Boolean!
    item: Item!
    sortTime: String!
  }

  type Invitification {
    id: ID!
    invite: Invite!
    sortTime: String!
  }

  type JobChanged {
    id: ID!
    item: Item!
    sortTime: String!
  }

  type EarnSources {
    id: ID!
    posts: Int!
    comments: Int!
    tipPosts: Int!
    tipComments: Int!
  }

  type Streak {
    id: ID!
    sortTime: String!
    days: Int
  }

  type Earn {
    id: ID!
    earnedSats: Int!
    sortTime: String!
    sources: EarnSources
  }

  type InvoicePaid {
    id: ID!
    earnedSats: Int!
    invoice: Invoice!
    sortTime: String!
  }

  type Referral {
    id: ID!
    sortTime: String!
  }

  union Notification = Reply | Votification | Mention
    | Invitification | Earn | JobChanged | InvoicePaid | Referral
    | Streak

  type Notifications {
    lastChecked: String
    cursor: String
    notifications: [Notification!]!
  }

  type PushSubscription {
    id: ID!
    userId: ID!
    endpoint: String!
    p256dh: String!
    auth: String!
  }
`
