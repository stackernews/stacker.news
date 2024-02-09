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
    sortTime: Date!
  }

  type ForwardedVotification {
    id: ID!
    earnedSats: Int!
    item: Item!
    sortTime: Date!
  }

  type FollowActivity {
    id: ID!
    item: Item!
    sortTime: Date!
  }

  type Reply {
    id: ID!
    item: Item!
    sortTime: Date!
  }

  type Mention {
    id: ID!
    mention: Boolean!
    item: Item!
    sortTime: Date!
  }

  type Invitification {
    id: ID!
    invite: Invite!
    sortTime: Date!
  }

  type JobChanged {
    id: ID!
    item: Item!
    sortTime: Date!
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
    sortTime: Date!
    days: Int
  }

  type Earn {
    id: ID!
    earnedSats: Int!
    minSortTime: Date!
    sortTime: Date!
    sources: EarnSources
  }

  type Revenue {
    id: ID!
    earnedSats: Int!
    sortTime: Date!
    subName: String!
  }

  type InvoicePaid {
    id: ID!
    earnedSats: Int!
    invoice: Invoice!
    sortTime: Date!
  }

  type Referral {
    id: ID!
    sortTime: Date!
  }

  type SubStatus {
    id: ID!
    sub: Sub!
    sortTime: Date!
  }

  type TerritoryPost {
    id: ID!
    item: Item!
    sortTime: Date!
  }

  union Notification = Reply | Votification | Mention
    | Invitification | Earn | JobChanged | InvoicePaid | Referral
    | Streak | FollowActivity | ForwardedVotification | Revenue | SubStatus | TerritoryPost

  type Notifications {
    lastChecked: Date
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
