import { gql } from 'graphql-tag'

export default gql`

enum PaymentMethod {
  FEE_CREDIT
  OPTIMISTIC
  PESSIMISTIC
}

type ItemPaidAction {
  result: Item
  invoice: Invoice
  paymentMethod: PaymentMethod!
}

type ItemActPaidAction {
  result: ItemActResult
  invoice: Invoice
  paymentMethod: PaymentMethod!
}

type PollPaidAction {
  result: PollVoteResult
  invoice: Invoice
  paymentMethod: PaymentMethod!
}

type SubPaidAction {
  result: Sub
  invoice: Invoice
  paymentMethod: PaymentMethod!
}

type DonatePaidAction {
  result: DonateResult
  invoice: Invoice
  paymentMethod: PaymentMethod!
}

`
