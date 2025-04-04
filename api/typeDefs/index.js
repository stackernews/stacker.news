import { gql } from 'graphql-tag'

import user from './user'
import message from './message'
import item from './item'
import itemForward from './itemForward'
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
import admin from './admin'
import blockHeight from './blockHeight'
import chainFee from './chainFee'
import paidAction from './paidAction'
import vault from './vault'
import domain from './domain'
import branding from './branding'

const common = gql`
  type Query {
    _: Boolean
  }

  type Mutation {
    _: Boolean
  }

  type Subscription {
    _: Boolean
  }

  scalar JSONObject
  scalar Date
  scalar Limit
`

export default [common, user, item, itemForward, message, wallet, lnurl, notifications, invite,
  sub, upload, growth, rewards, referrals, price, admin, blockHeight, chainFee, domain, branding, paidAction, vault]
