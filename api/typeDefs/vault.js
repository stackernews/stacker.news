import { gql } from 'graphql-tag'

export default gql`
  type VaultEntry {
    id: ID!
    key: String!
    iv: String!
    value: String!
    createdAt: Date!
    updatedAt: Date!
  }

  input VaultEntryInput {
    key: String!
    iv: String!
    value: String!
    walletId: ID
  }

  extend type Query {
    getVaultEntry(key: String!): VaultEntry
    getVaultEntries(keysFilter: [String!]): [VaultEntry!]!
  }

  extend type Mutation {
    clearVault: Boolean
    updateVaultKey(entries: [VaultEntryInput!]!, hash: String!): Boolean
  }
`
