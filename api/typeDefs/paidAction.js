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
  result: ItemActResult
  invoice: Invoice
  paymentMethod: PaymentMethod!
}

type PollVotePaidAction implements PaidAction {
  result: PollVoteResult
  invoice: Invoice
  paymentMethod: PaymentMethod!
}

type SubPaidAction implements PaidAction {
  result: Sub
  invoice: Invoice
  paymentMethod: PaymentMethod!
}

type DonatePaidAction implements PaidAction {
  result: DonateResult
  invoice: Invoice
  paymentMethod: PaymentMethod!
}

type BuyCreditsPaidAction implements PaidAction {
  result: BuyCreditsResult
  invoice: Invoice
  paymentMethod: PaymentMethod!
}
`
