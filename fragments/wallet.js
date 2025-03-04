import { gql } from '@apollo/client'
import { ITEM_FULL_FIELDS } from './items'
import { VAULT_ENTRY_FIELDS } from './vault'

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

export const REMOVE_WALLET =
gql`
mutation removeWallet($id: ID!) {
  removeWallet(id: $id)
}
`
// XXX [WALLET] this needs to be updated if another server wallet is added
export const WALLET_FIELDS = gql`
  ${VAULT_ENTRY_FIELDS}
  fragment WalletFields on Wallet {
    id
    priority
    type
    updatedAt
    enabled
    vaultEntries {
      ...VaultEntryFields
    }
    wallet {
      __typename
      ... on WalletLightningAddress {
        address
      }
      ... on WalletLnd {
        socket
        macaroon
        cert
      }
      ... on WalletCln {
        socket
        rune
        cert
      }
      ... on WalletLnbits {
        url
        invoiceKey
      }
      ... on WalletNwc {
        nwcUrlRecv
      }
      ... on WalletPhoenixd {
        url
        secondaryPassword
      }
      ... on WalletBlink {
        apiKeyRecv
        currencyRecv
      }
    }
  }
`

export const WALLET = gql`
  ${WALLET_FIELDS}
  query Wallet($id: ID!) {
    wallet(id: $id) {
      ...WalletFields
    }
  }
`

// XXX [WALLET] this needs to be updated if another server wallet is added
export const WALLET_BY_TYPE = gql`
  ${WALLET_FIELDS}
  query WalletByType($type: String!) {
    walletByType(type: $type) {
      ...WalletFields
    }
  }
`

export const WALLETS = gql`
  ${WALLET_FIELDS}
  query Wallets {
    wallets {
      ...WalletFields
    }
  }
`

export const WALLET_LOGS = gql`
  query WalletLogs($type: String, $from: String, $to: String, $cursor: String) {
    walletLogs(type: $type, from: $from, to: $to, cursor: $cursor) {
        cursor
        entries {
          id
          createdAt
          wallet
          level
          message
          context
        }
      }
  }
`

export const SET_WALLET_PRIORITY = gql`
  mutation SetWalletPriority($id: ID!, $priority: Int!) {
    setWalletPriority(id: $id, priority: $priority)
  }
`

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
