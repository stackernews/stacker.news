import { gql } from '@apollo/client'

// TODO(wallet-v2): generate these fragments
export const UPSERT_WALLET_SEND_LNBITS = gql`
  mutation upsertWalletSendLNbits($walletId: ID, $templateId: ID, $url: String!, $apiKey: VaultEntryInput!) {
    upsertWalletSendLNbits(walletId: $walletId, templateId: $templateId, url: $url, apiKey: $apiKey) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_LNBITS = gql`
  mutation upsertWalletRecvLNbits($walletId: ID, $templateId: ID, $url: String!, $apiKey: String!) {
    upsertWalletRecvLNbits(walletId: $walletId, templateId: $templateId, url: $url, apiKey: $apiKey) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_PHOENIXD = gql`
  mutation upsertWalletSendLNbits($walletId: ID, $templateId: ID, $url: String!, $apiKey: VaultEntryInput!) {
    upsertWalletSendPhoenixd(walletId: $walletId, templateId: $templateId, url: $url, apiKey: $apiKey) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_PHOENIXD = gql`
  mutation upsertWalletRecvLNbits($walletId: ID, $templateId: ID, $url: String!, $apiKey: String!) {
    upsertWalletRecvPhoenixd(walletId: $walletId, templateId: $templateId, url: $url, apiKey: $apiKey) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_BLINK = gql`
  mutation upsertWalletSendBlink($walletId: ID, $templateId: ID, $currency: VaultEntryInput!, $apiKey: VaultEntryInput!) {
    upsertWalletSendBlink(walletId: $walletId, templateId: $templateId, currency: $currency, apiKey: $apiKey) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_BLINK = gql`
  mutation upsertWalletRecvBlink($walletId: ID, $templateId: ID, $currency: String!, $apiKey: String!) {
    upsertWalletRecvBlink(walletId: $walletId, templateId: $templateId, currency: $currency, apiKey: $apiKey) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_LIGHTNING_ADDRESS = gql`
  mutation upsertWalletRecvLightningAddress($walletId: ID, $templateId: ID, $address: String!) {
    upsertWalletRecvLightningAddress(walletId: $walletId, templateId: $templateId, address: $address) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_NWC = gql`
  mutation upsertWalletSendNWC($walletId: ID, $templateId: ID, $url: VaultEntryInput!) {
    upsertWalletSendNWC(walletId: $walletId, templateId: $templateId, url: $url) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_NWC = gql`
  mutation upsertWalletRecvNWC($walletId: ID, $templateId: ID, $url: String!) {
    upsertWalletRecvNWC(walletId: $walletId, templateId: $templateId, url: $url) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_CLN_REST = gql`
  mutation upsertWalletRecvCLNRest($walletId: ID, $templateId: ID, $socket: String!, $rune: String!, $cert: String) {
    upsertWalletRecvCLNRest(walletId: $walletId, templateId: $templateId, socket: $socket, rune: $rune, cert: $cert) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_LNDGRPC = gql`
  mutation upsertWalletRecvLNDGRPC($walletId: ID, $templateId: ID, $socket: String!, $macaroon: String!, $cert: String) {
    upsertWalletRecvLNDGRPC(walletId: $walletId, templateId: $templateId, socket: $socket, macaroon: $macaroon, cert: $cert) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_LNC = gql`
  mutation upsertWalletSendLNC($walletId: ID, $templateId: ID, $pairingPhrase: VaultEntryInput!, $localKey: VaultEntryInput!, $remoteKey: VaultEntryInput!, $serverHost: VaultEntryInput!) {
    upsertWalletSendLNC(walletId: $walletId, templateId: $templateId, pairingPhrase: $pairingPhrase, localKey: $localKey, remoteKey: $remoteKey, serverHost: $serverHost) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_WEBLN = gql`
  mutation upsertWalletSendWebLN($walletId: ID, $templateId: ID) {
    upsertWalletSendWebLN(walletId: $walletId, templateId: $templateId) {
      id
    }
  }
`
