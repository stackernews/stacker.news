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
  fragment WalletProtocolFields on WalletProtocol {
    id
    name
    send
    enabled
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
      ... on WalletSendCLNRest {
        id
        socket
        encryptedRune: rune {
          ...VaultEntryFields
        }
      }
      ... on WalletSendClink {
        id
        encryptedNdebit: ndebit {
          ...VaultEntryFields
        }
        encryptedSecretKey: secretKey {
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
      ... on WalletRecvClink {
        id
        noffer
      }
    }
  }
`

const WALLET_TEMPLATE_FIELDS = gql`
  fragment WalletTemplateFields on WalletTemplate {
    # need to use field alias because of https://github.com/graphql/graphql-js/issues/53
    id: name
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
  fragment WalletFields on Wallet {
    id
    name
    priority
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
    ... on Wallet {
      ...WalletFields
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

export const SET_WALLET_PRIORITIES = gql`
  mutation SetWalletPriorities($priorities: [WalletPriorityUpdate!]!) {
    setWalletPriorities(priorities: $priorities)
  }
`

export const UPDATE_WALLET_ENCRYPTION = gql`
  mutation UpdateWalletEncryption($keyHash: String!, $wallets: [WalletEncryptionUpdate!]!) {
    updateWalletEncryption(keyHash: $keyHash, wallets: $wallets)
  }
`

export const UPDATE_KEY_HASH = gql`
  mutation UpdateKeyHash($keyHash: String!) {
    updateKeyHash(keyHash: $keyHash)
  }
`

export const RESET_WALLETS = gql`
  mutation ResetWallets($newKeyHash: String!) {
    resetWallets(newKeyHash: $newKeyHash)
  }
`

export const DELETE_WALLET = gql`
  mutation deleteWallet($id: ID!) {
    deleteWallet(id: $id)
  }`

export const DISABLE_PASSPHRASE_EXPORT = gql`
  mutation DisablePassphraseExport {
    disablePassphraseExport
  }
`

export const WALLET_SETTINGS = gql`
  query WalletSettings {
    walletSettings {
      receiveCreditsBelowSats
      sendCreditsBelowSats
      proxyReceive
      autoWithdrawMaxFeePercent
      autoWithdrawMaxFeeTotal
      autoWithdrawThreshold
    }
  }
`

export const SET_WALLET_SETTINGS = gql`
  mutation SetWalletSettings($settings: WalletSettingsInput!) {
    setWalletSettings(settings: $settings) {
      receiveCreditsBelowSats
      sendCreditsBelowSats
      proxyReceive
      autoWithdrawMaxFeePercent
      autoWithdrawMaxFeeTotal
      autoWithdrawThreshold
    }
  }
`

export const ADD_WALLET_LOG = gql`
  mutation AddWalletLog($protocolId: Int, $level: String!, $message: String!, $timestamp: Date!, $invoiceId: Int) {
    addWalletLog(protocolId: $protocolId, level: $level, message: $message, timestamp: $timestamp, invoiceId: $invoiceId)
  }
`

export const WALLET_LOGS = gql`
  query WalletLogs($protocolId: Int, $cursor: String, $debug: Boolean) {
    walletLogs(protocolId: $protocolId, cursor: $cursor, debug: $debug) {
      entries {
        id
        level
        message
        createdAt
        wallet {
          name
        }
        context
      }
      cursor
    }
  }
`

export const DELETE_WALLET_LOGS = gql`
  mutation DeleteWalletLogs($protocolId: Int, $debug: Boolean) {
    deleteWalletLogs(protocolId: $protocolId, debug: $debug)
  }
`
