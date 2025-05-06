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
    id: Int!
    createdAt: Date!
    updatedAt: Date!
    domainName: String!
    subName: String!
    status: DomainStatus
    records: [DomainVerificationRecord]
    attempts: [DomainVerificationAttempt]
    certificate: DomainCertificate
  }

  type DomainVerificationRecord {
    id: Int!
    createdAt: Date!
    updatedAt: Date!
    lastCheckedAt: Date
    domainId: Int!
    type: DomainVerificationType
    recordName: String!
    recordValue: String!
    status: DomainVerificationStatus
    attempts: [DomainVerificationAttempt]
  }

  type DomainVerificationAttempt {
    id: Int!
    createdAt: Date!
    updatedAt: Date!
    domainId: Int!
    verificationRecordId: Int
    status: DomainVerificationStatus
    message: String
  }

  type DomainCertificate {
    id: Int!
    createdAt: Date!
    updatedAt: Date!
    domainId: Int!
    certificateArn: String!
    status: DomainCertificateStatus
  }

  enum DomainStatus {
    PENDING
    ACTIVE
    HOLD
  }

  enum DomainVerificationType {
    TXT
    CNAME
    SSL
  }

  enum DomainVerificationStatus {
    PENDING
    VERIFIED
    FAILED
  }

  enum DomainCertificateStatus {
    PENDING_VALIDATION
    ISSUED
    INACTIVE
    EXPIRED
    REVOKED
    FAILED
    VALIDATION_TIMED_OUT
  }
  
  type DomainMapping {
    domainName: String!
    subName: String!
  }
`
