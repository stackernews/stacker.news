import { gql } from 'graphql-tag'

export default gql`

extend type Query {
  paidAction(invoiceId: Int!): PaidAction
}

extend type Mutation {
  retryPaidAction(invoiceId: Int!, newAttempt: Boolean): PaidAction!
}

enum PaymentMethod {
  REWARD_SATS
  FEE_CREDIT
  ZERO_COST
  OPTIMISTIC
  PESSIMISTIC
}

interface PaidAction {
  invoice: Invoice
  paymentMethod: PaymentMethod!
}

type ItemPaidAction implements PaidAction {
  result: Item
  invoice: Invoice
  paymentMethod: PaymentMethod!
}

type ItemActPaidAction implements PaidAction {
  invoice: Invoice
  paymentMethod: PaymentMethod!
}

type PollVotePaidAction implements PaidAction {
  invoice: Invoice
  paymentMethod: PaymentMethod!
}

type DonatePaidAction implements PaidAction {
  invoice: Invoice
  paymentMethod: PaymentMethod!
}
`
