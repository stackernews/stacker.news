import { gql } from 'graphql-tag'

export default gql`
  type Vault {
    id: ID!
    key: String!
    value: String!
    createdAt: Date!
    updatedAt: Date!
  }

  extend type Query {
    getVaultEntry(key: String!): Vault
  }

  extend type Mutation {
    setVaultEntry(key: String!, value: String!, skipIfSet: Boolean): Boolean
    unsetVaultEntry(key: String!): Boolean
    clearVault: Boolean
    setVaultKeyHash(hash: String!): String
  }
`
