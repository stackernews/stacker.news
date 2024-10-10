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

export const GET_ENTRY = gql`
  ${VAULT_FIELDS}
  query GetVaultEntry(
    $ownerId: ID!,
    $ownerType: String!,
    $key: String!
  ) {
    getVaultEntry(ownerId: $ownerId, ownerType: $ownerType, key: $key) {
      ...VaultFields
    }
  }
`

export const GET_ENTRIES = gql`
  ${VAULT_FIELDS}
  query GetVaultEntries(
    $ownerId: ID!,
    $ownerType: String!
  ) {
    getVaultEntries(ownerId: $ownerId, ownerType: $ownerType) {
      ...VaultFields
    }
  }
`

export const SET_ENTRY = gql`
  mutation SetVaultEntry(
      $ownerId: ID!,
      $ownerType: String!,
      $key: String!, 
      $value: String!, 
      $skipIfSet: Boolean
  ) {
    setVaultEntry(ownerId: $ownerId, ownerType: $ownerType, key: $key, value: $value, skipIfSet: $skipIfSet)
  }
`

export const UNSET_ENTRY = gql`
  mutation UnsetVaultEntry(
    $ownerId: ID!,
    $ownerType: String!,
    $key: String!
  ) {
    unsetVaultEntry(ownerId: $ownerId, ownerType: $ownerType, key: $key)
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
