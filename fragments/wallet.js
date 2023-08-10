import { gql } from '@apollo/client'
import { ITEM_FULL_FIELDS } from './items'

export const INVOICE = gql`
  query Invoice($id: ID!) {
    invoice(id: $id) {
      id
      hash
      bolt11
      satsRequested
      satsReceived
      cancelled
      confirmedAt
      expiresAt
      nostr
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
  ${ITEM_FULL_FIELDS}

  query WalletHistory($cursor: String, $inc: String) {
    walletHistory(cursor: $cursor, inc: $inc) {
      facts {
        id
        factId
        type
        createdAt
        sats
        satsFee
        status
        type
        description
        item {
          ...ItemFullFields
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

export const SEND_TO_LNADDR = gql`
  mutation sendToLnAddr($addr: String!, $amount: Int!, $maxFee: Int!) {
    sendToLnAddr(addr: $addr, amount: $amount, maxFee: $maxFee) {
      id
    }
}`
