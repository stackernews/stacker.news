import { gql } from 'graphql-tag'

export default gql`

type ItemPaidAction {
  result: Item
  invoice: Invoice
}

type ItemActPaidAction {
  result: ItemActResult
  invoice: Invoice
}

type PollPaidAction {
  result: PollVoteResult
  invoice: Invoice
}

type SubPaidAction {
  result: Sub
  invoice: Invoice
}

type DonatePaidAction {
  result: DonateResult
  invoice: Invoice
}

`
