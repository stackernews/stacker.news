import { gql } from '@apollo/client'
import { ITEM_FULL_FIELDS } from './items'

export const INVOICE_FIELDS = gql`
  fragment InvoiceFields on Invoice {
    id
    hash
    hmac
    bolt11
    satsRequested
    satsReceived
    cancelled
    cancelledAt
    confirmedAt
    expiresAt
    nostr
    isHeld
    comment
    lud18Data
    actionState
    actionType
    actionError
    confirmedPreimage
    forwardedSats
    forwardStatus
  }`

export const INVOICE_FULL = gql`
  ${ITEM_FULL_FIELDS}
  ${INVOICE_FIELDS}

  query Invoice($id: ID!) {
    invoice(id: $id) {
      ...InvoiceFields
      item {
        ...ItemFullFields
      }
    }
  }`

export const INVOICE = gql`
  ${INVOICE_FIELDS}

  query Invoice($id: ID!) {
    invoice(id: $id) {
      ...InvoiceFields
    }
  }`

export const WITHDRAWL = gql`
  query Withdrawl($id: ID!) {
    withdrawl(id: $id) {
      id
      createdAt
      bolt11
      hash
      satsPaid
      satsFeePaying
      satsFeePaid
      status
      autoWithdraw
      preimage
      forwardedActionType
    }
  }`

export const DIRECT = gql`
  query Direct($id: ID!) {
    direct(id: $id) {
      id
      createdAt
      bolt11
      hash
      sats
      preimage
      comment
      lud18Data
      nostr
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

export const CANCEL_INVOICE = gql`
  ${INVOICE_FIELDS}
  mutation cancelInvoice($hash: String!, $hmac: String, $userCancel: Boolean) {
    cancelInvoice(hash: $hash, hmac: $hmac, userCancel: $userCancel) {
      ...InvoiceFields
    }
  }
`

export const FAILED_INVOICES = gql`
  ${INVOICE_FIELDS}
  query FailedInvoices {
    failedInvoices {
      ...InvoiceFields
    }
  }
`
