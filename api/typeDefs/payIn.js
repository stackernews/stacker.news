import { gql } from 'graphql-tag'

export default gql`

extend type Query {
  payIn(id: Int!): PayIn
  satistics(cursor: String, inc: String): Satistics
}

extend type Mutation {
  retryPayIn(payInId: Int!): PayIn!
  cancelPayInBolt11(hash: String!, hmac: String, userCancel: Boolean): PayIn
}

type Satistics {
  payIns: [PayIn!]!
  cursor: String
}

enum CustodialTokenType {
  CREDITS
  SATS
}

enum PayInType {
  BUY_CREDITS
  ITEM_CREATE
  ITEM_UPDATE
  ZAP
  DOWN_ZAP
  BOOST
  DONATE
  POLL_VOTE
  INVITE_GIFT
  TERRITORY_CREATE
  TERRITORY_UPDATE
  TERRITORY_BILLING
  TERRITORY_UNARCHIVE
  PROXY_PAYMENT
  REWARDS
  WITHDRAWAL
  AUTO_WITHDRAWAL
}

enum PayInState {
  PENDING_INVOICE_CREATION
  PENDING_INVOICE_WRAP
  PENDING_WITHDRAWAL
  WITHDRAWAL_PAID
  WITHDRAWAL_FAILED
  PENDING
  PENDING_HELD
  HELD
  PAID
  FAILED
  FORWARDING
  FORWARDED
  FAILED_FORWARD
  CANCELLED
}

enum PayInFailureReason {
  INVOICE_CREATION_FAILED
  INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_FEE
  INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_EXPIRY
  INVOICE_WRAPPING_FAILED_UNKNOWN
  INVOICE_FORWARDING_CLTV_DELTA_TOO_LOW
  INVOICE_FORWARDING_FAILED
  HELD_INVOICE_UNEXPECTED_ERROR
  HELD_INVOICE_SETTLED_TOO_SLOW
  WITHDRAWAL_FAILED
  USER_CANCELLED
  SYSTEM_CANCELLED
  INVOICE_EXPIRED
  EXECUTION_FAILED
  UNKNOWN_FAILURE
}

type PayInBolt11Lud18 {
  id: Int!
  name: String
  identifier: String
  email: String
  pubkey: String
}

type PayInBolt11NostrNote {
  id: Int!
  note: JSONObject!
}

type PayInBolt11Comment {
  id: Int!
  comment: String!
}

type PayInBolt11 {
  id: Int!
  payInId: Int!
  hash: String!
  preimage: String
  hmac: String
  bolt11: String!
  expiresAt: Date!
  confirmedAt: Date
  cancelledAt: Date
  msatsRequested: BigInt!
  msatsReceived: BigInt
  createdAt: Date!
  updatedAt: Date!
  lud18Data: PayInBolt11Lud18
  nostrNote: PayInBolt11NostrNote
  comment: PayInBolt11Comment
}

type PayInCustodialToken {
  id: Int!
  payInId: Int!
  mtokens: BigInt!
  mtokensBefore: BigInt
  custodialTokenType: CustodialTokenType!
}

union PayInResult = Item | ItemAct | PollVote | Sub

type PayInPessimisticEnv {
  id: Int!
  payInId: Int!
  args: JSONObject
  error: String
  result: JSONObject
}

type PayIn {
  id: Int!
  createdAt: Date!
  updatedAt: Date!
  mcost: BigInt!
  userId: Int!
  payInType: PayInType!
  payInState: PayInState!
  payInFailureReason: PayInFailureReason
  payInStateChangedAt: Date!
  payInBolt11: PayInBolt11
  payInCustodialTokens: [PayInCustodialToken!]
  result: PayInResult
  pessimisticEnv: PayInPessimisticEnv
  payOutBolt11: PayOutBolt11
  payOutCustodialTokens: [PayOutCustodialToken!]
  item: Item
  sub: Sub
}

enum PayOutType {
  TERRITORY_REVENUE
  REWARDS_POOL
  ROUTING_FEE
  ROUTING_FEE_REFUND
  PROXY_PAYMENT
  ZAP
  REWARD
  INVITE_GIFT
  WITHDRAWAL
  SYSTEM_REVENUE
  BUY_CREDITS
}

enum WithdrawlStatus {
  INSUFFICIENT_BALANCE
  INVALID_PAYMENT
  PATHFINDING_TIMEOUT
  ROUTE_NOT_FOUND
  CONFIRMED
  UNKNOWN_FAILURE
}

type PayOutBolt11 {
  id: Int!
  createdAt: Date!
  updatedAt: Date!
  userId: Int
  payOutType: PayOutType!
  status: WithdrawlStatus!
  msats: BigInt!
  payInId: Int!
  hash: String!
  bolt11: String!
  expiresAt: Date!
}

type PayOutCustodialToken {
  id: Int!
  payInId: Int!
  userId: Int
  mtokens: BigInt!
  mtokensBefore: BigInt
  custodialTokenType: CustodialTokenType!
  payOutType: PayOutType!
  payIn: PayIn!
  sub: Sub
  user: User
}
`
