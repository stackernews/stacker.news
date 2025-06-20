import { gql } from '@apollo/client'

export const REMOVE_WALLET_PROTOCOL = gql`
  mutation removeWalletProtocol($id: ID!) {
    removeWalletProtocol(id: $id)
  }
`

export const UPSERT_WALLET_SEND_LNBITS = gql`
  mutation upsertWalletSendLNbits($walletId: ID, $templateId: ID, $enabled: Boolean!, $networkTests: Boolean, $url: String!, $apiKey: VaultEntryInput!) {
    upsertWalletSendLNbits(walletId: $walletId, templateId: $templateId, enabled: $enabled, networkTests: $networkTests, url: $url, apiKey: $apiKey) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_LNBITS = gql`
  mutation upsertWalletRecvLNbits($walletId: ID, $templateId: ID, $enabled: Boolean!, $networkTests: Boolean, $url: String!, $apiKey: String!) {
    upsertWalletRecvLNbits(walletId: $walletId, templateId: $templateId, enabled: $enabled, networkTests: $networkTests, url: $url, apiKey: $apiKey) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_PHOENIXD = gql`
  mutation upsertWalletSendLNbits($walletId: ID, $templateId: ID, $enabled: Boolean!, $networkTests: Boolean, $url: String!, $apiKey: VaultEntryInput!) {
    upsertWalletSendPhoenixd(walletId: $walletId, templateId: $templateId, enabled: $enabled, networkTests: $networkTests, url: $url, apiKey: $apiKey) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_PHOENIXD = gql`
  mutation upsertWalletRecvLNbits($walletId: ID, $templateId: ID, $enabled: Boolean!, $networkTests: Boolean, $url: String!, $apiKey: String!) {
    upsertWalletRecvPhoenixd(walletId: $walletId, templateId: $templateId, enabled: $enabled, networkTests: $networkTests, url: $url, apiKey: $apiKey) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_BLINK = gql`
  mutation upsertWalletSendBlink($walletId: ID, $templateId: ID, $enabled: Boolean!, $networkTests: Boolean, $currency: VaultEntryInput!, $apiKey: VaultEntryInput!) {
    upsertWalletSendBlink(walletId: $walletId, templateId: $templateId, enabled: $enabled, networkTests: $networkTests, currency: $currency, apiKey: $apiKey) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_BLINK = gql`
  mutation upsertWalletRecvBlink($walletId: ID, $templateId: ID, $enabled: Boolean!, $networkTests: Boolean, $currency: String!, $apiKey: String!) {
    upsertWalletRecvBlink(walletId: $walletId, templateId: $templateId, enabled: $enabled, networkTests: $networkTests, currency: $currency, apiKey: $apiKey) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_LIGHTNING_ADDRESS = gql`
  mutation upsertWalletRecvLightningAddress($walletId: ID, $templateId: ID, $enabled: Boolean!, $networkTests: Boolean, $address: String!) {
    upsertWalletRecvLightningAddress(walletId: $walletId, templateId: $templateId, enabled: $enabled, networkTests: $networkTests, address: $address) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_NWC = gql`
  mutation upsertWalletSendNWC($walletId: ID, $templateId: ID, $enabled: Boolean!, $networkTests: Boolean, $url: VaultEntryInput!) {
    upsertWalletSendNWC(walletId: $walletId, templateId: $templateId, enabled: $enabled, networkTests: $networkTests, url: $url) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_NWC = gql`
  mutation upsertWalletRecvNWC($walletId: ID, $templateId: ID, $enabled: Boolean!, $networkTests: Boolean, $url: String!) {
    upsertWalletRecvNWC(walletId: $walletId, templateId: $templateId, enabled: $enabled, networkTests: $networkTests, url: $url) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_CLN_REST = gql`
  mutation upsertWalletRecvCLNRest($walletId: ID, $templateId: ID, $enabled: Boolean!, $networkTests: Boolean, $socket: String!, $rune: String!, $cert: String) {
    upsertWalletRecvCLNRest(walletId: $walletId, templateId: $templateId, enabled: $enabled, networkTests: $networkTests, socket: $socket, rune: $rune, cert: $cert) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_LNDGRPC = gql`
  mutation upsertWalletRecvLNDGRPC($walletId: ID, $templateId: ID, $enabled: Boolean!, $networkTests: Boolean, $socket: String!, $macaroon: String!, $cert: String) {
    upsertWalletRecvLNDGRPC(walletId: $walletId, templateId: $templateId, enabled: $enabled, networkTests: $networkTests, socket: $socket, macaroon: $macaroon, cert: $cert) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_LNC = gql`
  mutation upsertWalletSendLNC($walletId: ID, $templateId: ID, $enabled: Boolean!, $networkTests: Boolean, $pairingPhrase: VaultEntryInput!, $localKey: VaultEntryInput!, $remoteKey: VaultEntryInput!, $serverHost: VaultEntryInput!) {
    upsertWalletSendLNC(walletId: $walletId, templateId: $templateId, enabled: $enabled, networkTests: $networkTests, pairingPhrase: $pairingPhrase, localKey: $localKey, remoteKey: $remoteKey, serverHost: $serverHost) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_WEBLN = gql`
  mutation upsertWalletSendWebLN($walletId: ID, $templateId: ID, $enabled: Boolean!, $networkTests: Boolean) {
    upsertWalletSendWebLN(walletId: $walletId, templateId: $templateId, enabled: $enabled, networkTests: $networkTests) {
      id
    }
  }
`
