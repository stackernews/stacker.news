import { gql } from 'graphql-tag'

export default gql`
  interface VaultOwner {
    id: ID!
  }
    
  type Vault {
    id: ID!
    key: String!
    value: String!
    createdAt: Date!
    updatedAt: Date!
  }

  extend type Query {
    getVaultEntry(ownerId:ID!, ownerType:String!, key: String!): Vault
    getVaultEntries(ownerId:ID!, ownerType:String!, keysFilter: [String]): [Vault!]!
  }

  extend type Mutation {
    setVaultEntry(ownerId:ID!, ownerType:String!, key: String!, value: String!, skipIfSet: Boolean): Boolean
    unsetVaultEntry(ownerId:ID!, ownerType:String!, key: String!): Boolean

    clearVault: Boolean
    setVaultKeyHash(hash: String!): String
  }
`
