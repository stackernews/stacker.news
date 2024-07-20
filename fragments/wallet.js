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
    confirmedAt
    expiresAt
    nostr
    isHeld
    comment
    lud18Data
    confirmedPreimage
    actionState
    actionType
    actionError
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
      satsPaid
      satsFeePaying
      satsFeePaid
      status
      autoWithdraw
      preimage
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

export const REMOVE_WALLET =
gql`
mutation removeWallet($id: ID!) {
  removeWallet(id: $id)
}
`

export const WALLET = gql`
  query Wallet($id: ID!) {
    wallet(id: $id) {
      id
      createdAt
      priority
      type
      wallet {
        __typename
        ... on WalletLNAddr {
          address
        }
        ... on WalletLND {
          socket
          macaroon
          cert
        }
        ... on WalletCLN {
          socket
          rune
          cert
        }
      }
    }
  }
`

export const WALLET_BY_TYPE = gql`
  query WalletByType($type: String!) {
    walletByType(type: $type) {
      id
      createdAt
      enabled
      priority
      type
      wallet {
        __typename
        ... on WalletLNAddr {
          address
        }
        ... on WalletLND {
          socket
          macaroon
          cert
        }
        ... on WalletCLN {
          socket
          rune
          cert
        }
      }
    }
  }
`

export const WALLETS = gql`
  query Wallets {
    wallets {
      id
      priority
      type
    }
  }
`

export const WALLET_LOGS = gql`
  query WalletLogs {
    walletLogs {
      id
      createdAt
      wallet
      level
      message
    }
  }
`
