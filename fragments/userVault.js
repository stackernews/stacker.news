import { gql } from '@apollo/client'

export const GET_ENTRY = gql`
  query GetVaultEntry($key: String!) {
    getVaultEntry(key: $key) {
      value
    }
  }
`

export const SET_ENTRY = gql`
  mutation SetVaultEntry($key: String!, $value: String!) {
    setVaultEntry(key: $key, value: $value)
  }
`

export const UNSET_ENTRY = gql`
  mutation UnsetVaultEntry($key: String!) {
    unsetVaultEntry(key: $key)
  }
`

export const CLEAR_VAULT = gql`
  mutation ClearVault {
    clearVault
  }
`

export const SET_VAULT_KEY_HASH = gql`
  mutation SetVaultKeyHash($hash: String!) {
    setVaultKeyHash(hash: $hash)
  }
`
