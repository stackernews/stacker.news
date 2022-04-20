import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    notifications(cursor: String, filter: String): Notifications
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

  type Earn {
    earnedSats: Int!
    sortTime: String!
  }

  type InvoicePaid {
    earnedSats: Int!
    invoice: Invoice!
    sortTime: String!
  }

  union Notification = Reply | Votification | Mention
    | Invitification | JobChanged | Earn | InvoicePaid

  type Notifications {
    lastChecked: String
    cursor: String
    notifications: [Notification!]!
  }
`
