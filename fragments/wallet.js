import { gql } from '@apollo/client'
import { ITEM_FULL_FIELDS } from './items'
import { VAULT_ENTRY_FIELDS } from './vault'

const WALLET_PROTOCOL_FIELDS = gql`
  ${VAULT_ENTRY_FIELDS}
  # need to use field aliases because of https://github.com/graphql/graphql-js/issues/53
  # TODO(wallet-v2): can I use a schema directive like @encrypted to rename the fields, and maybe do more?
  # see https://www.apollographql.com/docs/apollo-server/v3/schema/creating-directives
  fragment WalletProtocolFields on WalletProtocol {
    id
    name
    send
    config {
      __typename
      ... on WalletSendNWC {
        id
        encryptedUrl: url {
          ...VaultEntryFields
        }
      }
      ... on WalletSendLNbits {
        id
        url
        encryptedApiKey: apiKey {
          ...VaultEntryFields
        }
      }
      ... on WalletSendPhoenixd {
        id
        url
        encryptedApiKey: apiKey {
          ...VaultEntryFields
        }
      }
      ... on WalletSendBlink {
        id
        encryptedCurrency: currency {
          ...VaultEntryFields
        }
        encryptedApiKey: apiKey {
          ...VaultEntryFields
        }
      }
      ... on WalletSendWebLN {
        id
      }
      ... on WalletSendLNC {
        id
        encryptedPairingPhrase: pairingPhrase {
          ...VaultEntryFields
        }
        encryptedLocalKey: localKey {
          ...VaultEntryFields
        }
        encryptedRemoteKey: remoteKey {
          ...VaultEntryFields
        }
        encryptedServerHost: serverHost {
          ...VaultEntryFields
        }
      }
      ... on WalletRecvNWC {
        id
        url
      }
      ... on WalletRecvLNbits {
        id
        url
        apiKey
      }
      ... on WalletRecvPhoenixd {
        id
        url
        apiKey
      }
      ... on WalletRecvBlink {
        id
        currency
        apiKey
      }
      ... on WalletRecvLightningAddress {
        id
        address
      }
      ... on WalletRecvCLNRest {
        id
        socket
        rune
        cert
      }
      ... on WalletRecvLNDGRPC {
        id
        socket
        macaroon
        cert
      }
    }
  }
`

const WALLET_TEMPLATE_FIELDS = gql`
  fragment WalletTemplateFields on WalletTemplate {
    id
    name
    send
    receive
    protocols {
      id
      name
      send
    }
  }
`

const USER_WALLET_FIELDS = gql`
  ${WALLET_PROTOCOL_FIELDS}
  ${WALLET_TEMPLATE_FIELDS}
  fragment UserWalletFields on UserWallet {
    id
    name
    priority
    enabled
    send
    receive
    protocols {
      ...WalletProtocolFields
    }
    template {
      ...WalletTemplateFields
    }
  }
`

const WALLET_OR_TEMPLATE_FIELDS = gql`
  ${USER_WALLET_FIELDS}
  ${WALLET_TEMPLATE_FIELDS}
  fragment WalletOrTemplateFields on WalletOrTemplate {
    ... on UserWallet {
      ...UserWalletFields
    }
    ... on WalletTemplate {
      ...WalletTemplateFields
    }
  }
`

export const WALLETS = gql`
  ${WALLET_OR_TEMPLATE_FIELDS}
  query Wallets {
    wallets {
      ...WalletOrTemplateFields
    }
  }
`

export const WALLET = gql`
  ${WALLET_OR_TEMPLATE_FIELDS}
  query Wallet($id: ID, $name: String) {
    wallet(id: $id, name: $name) {
      ...WalletOrTemplateFields
    }
  }
`

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

export const REMOVE_WALLET = gql`
  mutation removeWallet($id: ID!) {
    removeWallet(id: $id)
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
