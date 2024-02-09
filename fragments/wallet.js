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
      isHeld
      comment
      lud18Data
      confirmedPreimage
    }
  }`

export const WITHDRAWL = gql`
  query Withdrawl($id: ID!) {
    withdrawl(id: $id) {
      id
      createdAt
      bolt11
      satsPaid
      satsFeePaying
      satsFeePaid
      status
      autoWithdraw
    }
  }`

export const WALLET_HISTORY = gql`
  ${ITEM_FULL_FIELDS}

  query WalletHistory($cursor: String, $inc: String) {
    walletHistory(cursor: $cursor, inc: $inc) {
      facts {
        id
        bolt11
        autoWithdraw
        type
        createdAt
        sats
        status
        type
        description
        invoiceComment
        invoicePayerData
        subName
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
  mutation sendToLnAddr($addr: String!, $amount: Int!, $maxFee: Int!, $comment: String, $identifier: Boolean, $name: String, $email: String) {
    sendToLnAddr(addr: $addr, amount: $amount, maxFee: $maxFee, comment: $comment, identifier: $identifier, name: $name, email: $email) {
      id
    }
}`
