import user from './user'
import message from './message'
import item from './item'
import walletV1 from './wallet'
import walletV2 from '@/wallets/server/resolvers'
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
import payIn from './payIn'

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

function isSafeInteger (val) {
  return val <= Number.MAX_SAFE_INTEGER && val >= Number.MIN_SAFE_INTEGER
}

function serializeBigInt (value) {
  if (isSafeInteger(value)) {
    return Number(value)
  }
  return value.toString()
}

const bigint = new GraphQLScalarType({
  name: 'BigInt',
  description: 'BigInt custom scalar type',
  serialize (value) {
    if (typeof value === 'bigint' || typeof value === 'number') {
      return serializeBigInt(value)
    } else if (typeof value === 'string') {
      const bigint = BigInt(value)
      if (bigint.toString() === value) {
        return serializeBigInt(bigint)
      }
    }
    throw Error('GraphQL BigInt Scalar serializer expected a `bigint` object got `' + typeof value + '` ' + value)
  },
  parseValue (value) {
    const bigint = BigInt(value.toString())
    if (bigint.toString() === value.toString()) {
      return bigint
    }

    throw new Error('GraphQL BigInt Scalar parser expected a `number` or `string` got `' + typeof value + '` ' + value)
  },
  parseLiteral (ast) {
    const bigint = BigInt(ast.value)
    if (bigint.toString() === ast.value.toString()) {
      return bigint
    }

    throw new Error('GraphQL BigInt Scalar parser expected a `number` or `string` got `' + typeof ast.value + '` ' + ast.value)
  }
})

const limit = createIntScalar({
  name: 'Limit',
  description: 'Limit custom scalar type',
  maximum: 1000
})

export default [user, item, message, walletV1, walletV2, lnurl, notifications, invite, sub,
  upload, search, growth, rewards, referrals, price, admin, blockHeight, chainFee,
  { JSONObject }, { Date: date }, { Limit: limit }, { BigInt: bigint }, payIn]
