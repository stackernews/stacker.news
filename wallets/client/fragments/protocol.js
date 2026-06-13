import { gql } from '@apollo/client'

// Receive-only protocol probe. Send protocols are tested entirely client-side
// and the per-protocol upsert mutations were replaced by the atomic
// `saveWalletProtocols` mutation.
export const TEST_WALLET_RECV_PROTOCOL = gql`
  mutation testWalletRecvProtocol($config: WalletRecvProtocolTestInput!) {
    testWalletRecvProtocol(config: $config)
  }
`
