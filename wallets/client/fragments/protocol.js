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
