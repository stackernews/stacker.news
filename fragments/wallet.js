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

export const UPSERT_WALLET_LNADDR =
gql`
mutation upsertWalletLNAddr($id: ID, $address: String!, $settings: AutowithdrawSettings!) {
  upsertWalletLNAddr(id: $id, address: $address, settings: $settings)
}
`

export const UPSERT_WALLET_LND =
gql`
mutation upsertWalletLND($id: ID, $socket: String!, $macaroon: String!, $cert: String, $settings: AutowithdrawSettings!) {
  upsertWalletLND(id: $id, socket: $socket, macaroon: $macaroon, cert: $cert, settings: $settings)
}
`

export const UPSERT_WALLET_CORE_LIGHTNING =
gql`
mutation upsertWalletCoreLightning($id: ID, $socket: String!, $rune: String!, $settings: AutowithdrawSettings!) {
  upsertWalletCoreLightning(id: $id, socket: $socket, rune: $rune, settings: $settings)
}
`

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
        ... on WalletCoreLightning {
          socket
          rune
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
        ... on WalletCoreLightning {
          socket
          rune
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
