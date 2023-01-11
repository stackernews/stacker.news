import { gql } from '@apollo/client'
import { ITEM_FIELDS } from './items'
import { USER_FIELDS } from './users'

export const INVOICE = gql`
  query Invoice($id: ID!) {
    invoice(id: $id) {
      id
      bolt11
      satsReceived
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
  ${USER_FIELDS}

  query WalletHistory($cursor: String, $inc: String) {
    me {
      ...UserFields
    }
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

export const SEND_TO_LNADDR = gql`
  mutation sendToLnAddr($addr: String!, $amount: Int!, $maxFee: Int!) {
    sendToLnAddr(addr: $addr, amount: $amount, maxFee: $maxFee) {
      id
    }
}`
