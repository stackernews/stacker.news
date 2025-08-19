import { gql } from 'graphql-tag'

export default gql`

extend type Query {
  payIn(id: Int!): PayIn
}

extend type Mutation {
  retryPayIn(payInId: Int!): PayIn!
  cancelPayInBolt11(hash: String!, hmac: String, userCancel: Boolean): PayIn
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
  payInType: PayInType!
  payInState: PayInState!
  payInFailureReason: PayInFailureReason
  payInStateChangedAt: Date!
  payInBolt11: PayInBolt11
  payInCustodialTokens: [PayInCustodialToken!]!
  result: PayInResult
  pessimisticEnv: PayInPessimisticEnv
}
`
