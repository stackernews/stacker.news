import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    notifications(cursor: String, inc: String): Notifications
  }

  extend type Mutation {
    savePushSubscription(endpoint: String!, p256dh: String!, auth: String!): PushSubscription
  }

  type Votification {
    earnedSats: Int!
    item: Item!
    sortTime: String!
  }

  type Reply {
    item: Item!
    sortTime: String!
  }

  type Mention {
    mention: Boolean!
    item: Item!
    sortTime: String!
  }

  type Invitification {
    invite: Invite!
    sortTime: String!
  }

  type JobChanged {
    item: Item!
    sortTime: String!
  }

  type EarnSources {
    posts: Int!
    comments: Int!
    tips: Int!
  }

  type Streak {
    sortTime: String!
    days: Int
    id: ID!
  }

  type Earn {
    earnedSats: Int!
    sortTime: String!
    sources: EarnSources
  }

  type InvoicePaid {
    earnedSats: Int!
    invoice: Invoice!
    sortTime: String!
  }

  type Referral {
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
