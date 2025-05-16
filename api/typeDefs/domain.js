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
    status: DomainVerificationStatus
    records: DomainVerificationRecordMap
    attempts: [DomainVerificationAttempt]
    certificate: DomainCertificate
  }

  type DomainVerificationRecord {
    id: Int!
    createdAt: Date!
    updatedAt: Date!
    lastCheckedAt: Date
    domainId: Int!
    type: DomainRecordType
    recordName: String!
    recordValue: String!
    status: DomainVerificationStatus
    attempts: [DomainVerificationAttempt]
  }

  type DomainVerificationRecordMap {
    CNAME: DomainVerificationRecord
    TXT: DomainVerificationRecord
    SSL: DomainVerificationRecord
  }

  type DomainVerificationAttempt {
    id: Int!
    createdAt: Date!
    updatedAt: Date!
    domainId: Int!
    verificationRecordId: Int
    stage: DomainVerificationStage
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

  enum DomainVerificationStage {
    GENERAL
    CNAME
    TXT
    ACM_REQUEST_CERTIFICATE
    ACM_REQUEST_VALIDATION_VALUES
    ACM_VALIDATION
    VERIFICATION_COMPLETE
  }

  enum DomainRecordType {
    TXT
    CNAME
    SSL
  }

  enum DomainVerificationStatus {
    PENDING
    VERIFIED
    FAILED
    ACTIVE
    HOLD
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
