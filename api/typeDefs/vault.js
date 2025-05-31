import { gql } from 'graphql-tag'

export default gql`
  type VaultEntry {
    id: ID!
    iv: String!
    value: String!
    createdAt: Date!
    updatedAt: Date!
  }

  input VaultEntryInput {
    iv: String!
    value: String!
  }

  extend type Query {
    getVaultEntries: [VaultEntry!]!
  }

  extend type Mutation {
    clearVault: Boolean
    updateVaultKey(entries: [VaultEntryInput!]!, hash: String!): Boolean
  }
`
