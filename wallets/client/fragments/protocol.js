import { gql } from '@apollo/client'

const shared = {
  variables: '$walletId: ID, $templateName: ID, $enabled: Boolean!',
  arguments: 'walletId: $walletId, templateName: $templateName, enabled: $enabled'
}

export const REMOVE_WALLET_PROTOCOL = gql`
  mutation removeWalletProtocol($id: ID!) {
    removeWalletProtocol(id: $id)
  }
`

// upserts

export const UPSERT_WALLET_SEND_LNBITS = gql`
  mutation upsertWalletSendLNbits(
    ${shared.variables},
    $url: String!,
    $apiKey: VaultEntryInput!
  ) {
    upsertWalletSendLNbits(
      ${shared.arguments}
      url: $url,
      apiKey: $apiKey
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_LNBITS = gql`
  mutation upsertWalletRecvLNbits(
    ${shared.variables},
    $url: String!,
    $apiKey: String!
  ) {
    upsertWalletRecvLNbits(
      ${shared.arguments},
      url: $url,
      apiKey: $apiKey
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_PHOENIXD = gql`
  mutation upsertWalletSendPhoenixd(
    ${shared.variables},
    $url: String!,
    $apiKey: VaultEntryInput!
  ) {
    upsertWalletSendPhoenixd(
      ${shared.arguments},
      url: $url,
      apiKey: $apiKey
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_PHOENIXD = gql`
  mutation upsertWalletRecvPhoenixd(
    ${shared.variables},
    $url: String!,
    $apiKey: String!
  ) {
    upsertWalletRecvPhoenixd(
      ${shared.arguments},
      url: $url,
      apiKey: $apiKey
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_BLINK = gql`
  mutation upsertWalletSendBlink(
    ${shared.variables},
    $currency: VaultEntryInput!,
    $apiKey: VaultEntryInput!
  ) {
    upsertWalletSendBlink(
      ${shared.arguments},
      currency: $currency,
      apiKey: $apiKey
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_BLINK = gql`
  mutation upsertWalletRecvBlink(
    ${shared.variables},
    $currency: String!,
    $apiKey: String!
  ) {
    upsertWalletRecvBlink(
      ${shared.arguments},
      currency: $currency,
      apiKey: $apiKey
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_LIGHTNING_ADDRESS = gql`
  mutation upsertWalletRecvLightningAddress(
    ${shared.variables},
    $address: String!
  ) {
    upsertWalletRecvLightningAddress(
      ${shared.arguments},
      address: $address
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_NWC = gql`
  mutation upsertWalletSendNWC(
    ${shared.variables},
    $url: VaultEntryInput!
  ) {
    upsertWalletSendNWC(
      ${shared.arguments},
      url: $url
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_NWC = gql`
  mutation upsertWalletRecvNWC(
    ${shared.variables},
    $url: String!
  ) {
    upsertWalletRecvNWC(
      ${shared.arguments},
      url: $url
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_CLN_REST = gql`
  mutation upsertWalletSendCLNRest(
    ${shared.variables},
    $socket: String!,
    $rune: VaultEntryInput!,
  ) {
    upsertWalletSendCLNRest(
      ${shared.arguments},
      socket: $socket,
      rune: $rune,
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_CLN_REST = gql`
  mutation upsertWalletRecvCLNRest(
    ${shared.variables},
    $socket: String!,
    $rune: String!,
    $cert: String
  ) {
    upsertWalletRecvCLNRest(
      ${shared.arguments},
      socket: $socket,
      rune: $rune,
      cert: $cert
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_LND_GRPC = gql`
  mutation upsertWalletRecvLNDGRPC(
    ${shared.variables},
    $socket: String!,
    $macaroon: String!,
    $cert: String
  ) {
    upsertWalletRecvLNDGRPC(
      ${shared.arguments},
      socket: $socket,
      macaroon: $macaroon,
      cert: $cert
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_LNC = gql`
  mutation upsertWalletSendLNC(
    ${shared.variables},
    $pairingPhrase: VaultEntryInput!,
    $localKey: VaultEntryInput!,
    $remoteKey: VaultEntryInput!,
    $serverHost: VaultEntryInput!
  ) {
    upsertWalletSendLNC(
      ${shared.arguments},
      pairingPhrase: $pairingPhrase,
      localKey: $localKey,
      remoteKey: $remoteKey,
      serverHost: $serverHost
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_WEBLN = gql`
  mutation upsertWalletSendWebLN(
    ${shared.variables}
  ) {
    upsertWalletSendWebLN(
      ${shared.arguments}
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_CLINK = gql`
  mutation upsertWalletSendClink(
    ${shared.variables},
    $ndebit: VaultEntryInput!,
    $secretKey: VaultEntryInput!
  ) {
    upsertWalletSendClink(
      ${shared.arguments},
      ndebit: $ndebit,
      secretKey: $secretKey
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_CLINK = gql`
  mutation upsertWalletRecvClink(
    ${shared.variables},
    $noffer: String!
  ) {
    upsertWalletRecvClink(
      ${shared.arguments},
      noffer: $noffer
    ) {
      id
    }
  }
`

// tests

export const TEST_WALLET_RECEIVE_NWC = gql`
  mutation testWalletRecvNWC($url: String!) {
    testWalletRecvNWC(url: $url)
  }
`

export const TEST_WALLET_RECEIVE_LIGHTNING_ADDRESS = gql`
  mutation testWalletRecvLightningAddress($address: String!) {
    testWalletRecvLightningAddress(address: $address)
  }
`

export const TEST_WALLET_RECEIVE_CLN_REST = gql`
  mutation testWalletRecvCLNRest($socket: String!, $rune: String!, $cert: String) {
    testWalletRecvCLNRest(socket: $socket, rune: $rune, cert: $cert)
  }
`

export const TEST_WALLET_RECEIVE_LND_GRPC = gql`
  mutation testWalletRecvLNDGRPC($socket: String!, $macaroon: String!, $cert: String) {
    testWalletRecvLNDGRPC(socket: $socket, macaroon: $macaroon, cert: $cert)
  }
`

export const TEST_WALLET_RECEIVE_PHOENIXD = gql`
  mutation testWalletRecvPhoenixd($url: String!, $apiKey: String!) {
    testWalletRecvPhoenixd(url: $url, apiKey: $apiKey)
  }
`

export const TEST_WALLET_RECEIVE_LNBITS = gql`
  mutation testWalletRecvLNbits($url: String!, $apiKey: String!) {
    testWalletRecvLNbits(url: $url, apiKey: $apiKey)
  }
`

export const TEST_WALLET_RECEIVE_BLINK = gql`
  mutation testWalletRecvBlink($currency: String!, $apiKey: String!) {
    testWalletRecvBlink(currency: $currency, apiKey: $apiKey)
  }
`

export const TEST_WALLET_RECEIVE_CLINK = gql`
  mutation testWalletRecvClink($noffer: String!) {
    testWalletRecvClink(noffer: $noffer)
  }
`
