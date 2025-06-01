import user from './user'
import message from './message'
import item from './item'
import wallet from './wallet'
import userWallet from '@/wallets/server/resolvers'
import lnurl from './lnurl'
import notifications from './notifications'
import invite from './invite'
import sub from './sub'
import upload from './upload'
import growth from './growth'
import search from './search'
import rewards from './rewards'
import referrals from './referrals'
import price from './price'
import { GraphQLJSONObject as JSONObject } from 'graphql-type-json'
import admin from './admin'
import blockHeight from './blockHeight'
import chainFee from './chainFee'
import { GraphQLScalarType, Kind } from 'graphql'
import { createIntScalar } from 'graphql-scalar'
import paidAction from './paidAction'

const date = new GraphQLScalarType({
  name: 'Date',
  description: 'Date custom scalar type',
  serialize (value) {
    if (value instanceof Date) {
      return value.toISOString() // Convert outgoing Date to string for JSON
    } else if (typeof value === 'string') {
      return value
    }
    throw Error('GraphQL Date Scalar serializer expected a `Date` object got `' + typeof value + '` ' + value)
  },
  parseValue (value) {
    if (typeof value === 'string') {
      return new Date(value) // Convert incoming string to Date
    }
    throw new Error('GraphQL Date Scalar parser expected a `string`')
  },
  parseLiteral (ast) {
    if (ast.kind === Kind.STRING) {
      // Convert hard-coded AST string to integer and then to Date
      return new Date(ast.value)
    }
    // Invalid hard-coded value (not an integer)
    return null
  }
})

const limit = createIntScalar({
  name: 'Limit',
  description: 'Limit custom scalar type',
  maximum: 1000
})

export default [user, item, message, wallet, userWallet, lnurl, notifications, invite, sub,
  upload, search, growth, rewards, referrals, price, admin, blockHeight, chainFee,
  { JSONObject }, { Date: date }, { Limit: limit }, paidAction]
