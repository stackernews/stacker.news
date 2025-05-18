import { gql } from '@apollo/client'

export const VAULT_ENTRY_FIELDS = gql`
  fragment VaultEntryFields on VaultEntry {
    id
    iv
    value
  }
`

export const GET_VAULT_ENTRIES = gql`
  ${VAULT_ENTRY_FIELDS}
  query GetVaultEntries {
    getVaultEntries {
      ...VaultEntryFields
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
