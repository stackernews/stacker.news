import { gql } from '@apollo/client'

export const VAULT_FIELDS = gql`
  fragment VaultFields on Vault {
    id
    key
    value
    createdAt
    updatedAt
  }
`

export const GET_VAULT_ENTRY = gql`
  ${VAULT_FIELDS}
  query GetVaultEntry(
    $key: String!
  ) {
    getVaultEntry(key: $key) {
      ...VaultFields
    }
  }
`

export const GET_VAULT_ENTRIES = gql`
  ${VAULT_FIELDS}
  query GetVaultEntries {
    getVaultEntries {
      ...VaultFields
    }
  }
`

export const CLEAR_VAULT = gql`
  mutation ClearVault {
    clearVault
  }
`

export const UPDATE_VAULT_KEY = gql`
  mutation updateVaultKey($entries: [VaultEntryInput!]!, $hash: String!) {
    updateVaultKey(entries: $entries, hash: $hash)
  }
`
