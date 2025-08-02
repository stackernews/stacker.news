import { gql } from '@apollo/client'

const sharedSend = {
  variables: '$walletId: ID, $templateName: ID, $enabled: Boolean!',
  arguments: 'walletId: $walletId, templateName: $templateName, enabled: $enabled'
}

const sharedRecv = {
  variables: `${sharedSend.variables}, $networkTests: Boolean`,
  arguments: `${sharedSend.arguments}, networkTests: $networkTests`
}

export const REMOVE_WALLET_PROTOCOL = gql`
  mutation removeWalletProtocol($id: ID!) {
    removeWalletProtocol(id: $id)
  }
`

export const UPSERT_WALLET_SEND_LNBITS = gql`
  mutation upsertWalletSendLNbits(
    ${sharedSend.variables},
    $url: String!,
    $apiKey: VaultEntryInput!
  ) {
    upsertWalletSendLNbits(
      ${sharedSend.arguments}
      url: $url,
      apiKey: $apiKey
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_LNBITS = gql`
  mutation upsertWalletRecvLNbits(
    ${sharedRecv.variables},
    $url: String!,
    $apiKey: String!
  ) {
    upsertWalletRecvLNbits(
      ${sharedRecv.arguments},
      url: $url,
      apiKey: $apiKey
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_PHOENIXD = gql`
  mutation upsertWalletSendPhoenixd(
    ${sharedSend.variables},
    $url: String!,
    $apiKey: VaultEntryInput!
  ) {
    upsertWalletSendPhoenixd(
      ${sharedSend.arguments},
      url: $url,
      apiKey: $apiKey
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_PHOENIXD = gql`
  mutation upsertWalletRecvPhoenixd(
    ${sharedRecv.variables},
    $url: String!,
    $apiKey: String!
  ) {
    upsertWalletRecvPhoenixd(
      ${sharedRecv.arguments},
      url: $url,
      apiKey: $apiKey
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_BLINK = gql`
  mutation upsertWalletSendBlink(
    ${sharedSend.variables},
    $currency: VaultEntryInput!,
    $apiKey: VaultEntryInput!
  ) {
    upsertWalletSendBlink(
      ${sharedSend.arguments},
      currency: $currency,
      apiKey: $apiKey
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_BLINK = gql`
  mutation upsertWalletRecvBlink(
    ${sharedRecv.variables},
    $currency: String!,
    $apiKey: String!
  ) {
    upsertWalletRecvBlink(
      ${sharedRecv.arguments},
      currency: $currency,
      apiKey: $apiKey
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_LIGHTNING_ADDRESS = gql`
  mutation upsertWalletRecvLightningAddress(
    ${sharedRecv.variables},
    $address: String!
  ) {
    upsertWalletRecvLightningAddress(
      ${sharedRecv.arguments},
      address: $address
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_SEND_NWC = gql`
  mutation upsertWalletSendNWC(
    ${sharedSend.variables},
    $url: VaultEntryInput!
  ) {
    upsertWalletSendNWC(
      ${sharedSend.arguments},
      url: $url
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_NWC = gql`
  mutation upsertWalletRecvNWC(
    ${sharedRecv.variables},
    $url: String!
  ) {
    upsertWalletRecvNWC(
      ${sharedRecv.arguments},
      url: $url
    ) {
      id
    }
  }
`

export const UPSERT_WALLET_RECEIVE_CLN_REST = gql`
  mutation upsertWalletRecvCLNRest(
    ${sharedRecv.variables},
    $socket: String!,
    $rune: String!,
    $cert: String
  ) {
    upsertWalletRecvCLNRest(
      ${sharedRecv.arguments},
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
    ${sharedRecv.variables},
    $socket: String!,
    $macaroon: String!,
    $cert: String
  ) {
    upsertWalletRecvLNDGRPC(
      ${sharedRecv.arguments},
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
    ${sharedSend.variables},
    $pairingPhrase: VaultEntryInput!,
    $localKey: VaultEntryInput!,
    $remoteKey: VaultEntryInput!,
    $serverHost: VaultEntryInput!
  ) {
    upsertWalletSendLNC(
      ${sharedSend.arguments},
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
    ${sharedSend.variables}
  ) {
    upsertWalletSendWebLN(
      ${sharedSend.arguments}
    ) {
      id
    }
  }
`
