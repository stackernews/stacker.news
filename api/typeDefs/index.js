import { gql } from 'apollo-server-micro'

import user from './user'
import message from './message'
import item from './item'
import wallet from './wallet'
import lnurl from './lnurl'
import notifications from './notifications'
import invite from './invite'
import sub from './sub'
import upload from './upload'
import growth from './growth'
import rewards from './rewards'
import referrals from './referrals'
import price from './price'

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

export default [link, user, item, message, wallet, lnurl, notifications, invite,
  sub, upload, growth, rewards, referrals, price]
