import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    notifications(cursor: String): Notifications
  }

  type Votification {
    earnedSats: Int!
    item: Item!
  }

  type Reply {
    item: Item!
  }

  union Notification = Reply | Votification

  type Notifications {
    cursor: String
    notifications: [Notification!]!
  }
`
