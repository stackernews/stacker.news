import user from './user'
import message from './message'
import item from './item'
import wallet from './wallet'
import lnurl from './lnurl'
import notifications from './notifications'
import invite from './invite'
import sub from './sub'
import upload from './upload'
import { GraphQLJSONObject } from 'graphql-type-json'

export default [user, item, message, wallet, lnurl, notifications, invite, sub,
  upload, { JSONObject: GraphQLJSONObject }]
