import { gql } from '@apollo/client'

export const INVOICE = gql`
  query Invoice($id: ID!) {
    invoice(id: $id) {
      id
      bolt11
      msatsReceived
      cancelled
      confirmedAt
      expiresAt
    }
  }`

export const WITHDRAWL = gql`
  query Withdrawl($id: ID!) {
    withdrawl(id: $id) {
      id
      bolt11
      satsPaid
      satsFeePaying
      satsFeePaid
      status
    }
  }`

export const WALLET_HISTORY = gql`
  query WalletHistory($cursor: String) {
    walletHistory(cursor: $cursor) {
      facts {
        id
        type
        createdAt
        msats
        msatsFee
        status
        type
        description
      }
      cursor
    }
  }
`

export const CREATE_WITHDRAWL = gql`
  mutation createWithdrawl($invoice: String!, $maxFee: Int!) {
    createWithdrawl(invoice: $invoice, maxFee: $maxFee) {
      id
    }
}`
