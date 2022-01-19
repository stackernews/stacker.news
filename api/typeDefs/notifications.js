import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    notifications(cursor: String): Notifications
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

  union Notification = Reply | Votification | Mention | Invitification

  type Notifications {
    lastChecked: String
    cursor: String
    notifications: [Notification!]!
  }
`
