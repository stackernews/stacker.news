import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    customDomain(subName: String!): CustomDomain
    domainMapping(domain: String!): DomainMapping
  }

  extend type Mutation {
    setCustomDomain(subName: String!, domain: String!): CustomDomain
  }

  type CustomDomain {
    createdAt: Date!
    updatedAt: Date!
    domain: String!
    subName: String!
    lastVerifiedAt: Date
    failedAttempts: Int
    status: String
    verification: CustomDomainVerification
  }
  
  type DomainMapping {
    domain: String!
    subName: String!
  }

  type CustomDomainVerification {
    dns: CustomDomainVerificationDNS
    ssl: CustomDomainVerificationSSL
  }

  type CustomDomainVerificationDNS {
    state: String
    cname: String
    txt: String
  }

  type CustomDomainVerificationSSL {
    state: String
    arn: String
    cname: String
    value: String
  }
`
