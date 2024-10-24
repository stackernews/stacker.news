import { gql } from 'graphql-tag'

export default gql`

extend type Query {
  paidAction(invoiceId: Int!): PaidAction
}

extend type Mutation {
  retryPaidAction(invoiceId: Int!,forceFeeCredits: Boolean): PaidAction
}

enum PaymentMethod {
  FEE_CREDIT
  OPTIMISTIC
  PESSIMISTIC
}

interface PaidAction {
  invoice: Invoice
  paymentMethod: PaymentMethod!,
  canRetry: Boolean
}

type ItemPaidAction implements PaidAction {
  result: Item
  invoice: Invoice
  paymentMethod: PaymentMethod!,
  canRetry: Boolean
}

type ItemActPaidAction implements PaidAction {
  result: ItemActResult
  invoice: Invoice
  paymentMethod: PaymentMethod!,
  canRetry: Boolean
}

type PollVotePaidAction implements PaidAction {
  result: PollVoteResult
  invoice: Invoice
  paymentMethod: PaymentMethod!,
  canRetry: Boolean
}

type SubPaidAction implements PaidAction {
  result: Sub
  invoice: Invoice
  paymentMethod: PaymentMethod!,
  canRetry: Boolean
}

type DonatePaidAction implements PaidAction {
  result: DonateResult
  invoice: Invoice
  paymentMethod: PaymentMethod!,
  canRetry: Boolean
}

`
