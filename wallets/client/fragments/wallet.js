import { gql } from '@apollo/client'

const VAULT_ENTRY_FIELDS = gql`
  fragment VaultEntryFields on VaultEntry {
    id
    iv
    value
  }
`

export const CLEAR_VAULT = gql`
  mutation ClearVault {
    clearVault
  }
`

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

export const REMOVE_WALLET = gql`
  mutation removeWallet($id: ID!) {
    removeWallet(id: $id)
  }
`

export const SET_WALLET_PRIORITY = gql`
  mutation SetWalletPriority($id: ID!, $priority: Int!) {
    setWalletPriority(id: $id, priority: $priority)
  }
`
