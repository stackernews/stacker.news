import { gql } from 'graphql-tag'

export default gql`

extend type Query {
  paidAction(invoiceId: Int!): PaidAction
}

extend type Mutation {
  retryPaidAction(invoiceId: Int!, forceInternal: Boolean, attempt: Int, prioritizeInternal: Boolean): PaidAction!
}

enum PaymentMethod {
  FEE_CREDIT
  ZERO_COST
  OPTIMISTIC
  PESSIMISTIC
}

interface PaidAction {
  invoice: Invoice
  paymentMethod: PaymentMethod!
  retriable: Boolean
}

type ItemPaidAction implements PaidAction {
  result: Item
  invoice: Invoice
  paymentMethod: PaymentMethod!
  retriable: Boolean
}

type ItemActPaidAction implements PaidAction {
  result: ItemActResult
  invoice: Invoice
  paymentMethod: PaymentMethod!
  retriable: Boolean
}

type PollVotePaidAction implements PaidAction {
  result: PollVoteResult
  invoice: Invoice
  paymentMethod: PaymentMethod!
  retriable: Boolean
}

type SubPaidAction implements PaidAction {
  result: Sub
  invoice: Invoice
  paymentMethod: PaymentMethod!
  retriable: Boolean
}

type DonatePaidAction implements PaidAction {
  result: DonateResult
  invoice: Invoice
  paymentMethod: PaymentMethod!
  retriable: Boolean
}

`
