import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    domain(subName: String!): Domain
    domainMapping(domainName: String!): DomainMapping
  }

  extend type Mutation {
    setDomain(subName: String!, domainName: String!): Domain
  }

  type Domain {
    createdAt: Date!
    updatedAt: Date!
    domainName: String!
    subName: String!
    status: String
    verifications: [DomainVerification]
  }

  type DomainVerification {
    createdAt: Date!
    updatedAt: Date!
    domainId: Int!
    type: DomainVerificationType
    state: String
    host: String
    value: String
    sslArn: String
    result: String
    lastCheckedAt: Date
  }

  enum DomainVerificationType {
    TXT
    CNAME
    SSL
  }
  
  type DomainMapping {
    domainName: String!
    subName: String!
  }
`
