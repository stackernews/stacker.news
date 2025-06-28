import { gql } from 'graphql-tag'

export default gql`
  type OAuthApplication {
    id: ID!
    createdAt: Date!
    updatedAt: Date!
    name: String!
    description: String
    homepageUrl: String
    privacyPolicyUrl: String
    termsOfServiceUrl: String
    clientId: String!
    clientSecretHash: String
    redirectUris: [String!]!
    scopes: [String!]!
    logoUrl: String
    userId: ID!
    approved: Boolean!
    suspended: Boolean!
    suspendedReason: String
    rateLimitRpm: Int
    rateLimitDaily: Int
    isConfidential: Boolean!
    pkceRequired: Boolean!
  }

  extend type Query {
    oAuthApplications: [OAuthApplication!]!
    oAuthApplication(id: ID!): OAuthApplication
  }

  extend type Mutation {
    createOAuthApplication(
      name: String!
      description: String
      homepageUrl: String
      privacyPolicyUrl: String
      termsOfServiceUrl: String
      redirectUris: [String!]!
      scopes: [String!]!
      logoUrl: String
    ): OAuthApplication!
    updateOAuthApplication(
      id: ID!
      name: String
      description: String
      homepageUrl: String
      privacyPolicyUrl: String
      termsOfServiceUrl: String
      redirectUris: [String!]
      scopes: [String!]
      logoUrl: String
    ): OAuthApplication!
    deleteOAuthApplication(id: ID!): OAuthApplication
  }
`
