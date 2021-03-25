import { gql } from 'apollo-server-micro'

import user from './user'
import message from './message'

const link = gql`
  type Query {
    _: Boolean
  }

  type Mutation {
    _: Boolean
  }

  type Subscription {
    _: Boolean
  }
`

export default [link, user, message]
