import { gql } from '@apollo/client'
import { ITEM_FIELDS } from './items'

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
  ${ITEM_FIELDS}

  query WalletHistory($cursor: String, $inc: String) {
    walletHistory(cursor: $cursor, inc: $inc) {
      facts {
        id
        factId
        type
        createdAt
        msats
        msatsFee
        status
        type
        description
        item {
          ...ItemFields
          text
        }
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
