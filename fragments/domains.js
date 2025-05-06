import { gql } from 'graphql-tag'

export const DOMAIN_FIELDS = gql`
  fragment DomainFields on Domain {
    domainName
    status
    subName
  }
`

export const DOMAIN_VERIFICATION_RECORD_FIELDS = gql`
  fragment DomainVerificationRecordFields on DomainVerificationRecord {
    id
    type
    recordName
    recordValue
    status
    lastCheckedAt
  }
`

export const DOMAIN_VERIFICATION_RECORD_MAP_FIELDS = gql`
  ${DOMAIN_VERIFICATION_RECORD_FIELDS}
  fragment DomainVerificationRecordMapFields on DomainVerificationRecordMap {
    CNAME {
      ...DomainVerificationRecordFields
    }
    TXT {
      ...DomainVerificationRecordFields
    }
    SSL {
      ...DomainVerificationRecordFields
    }
  }
`

export const DOMAIN_VERIFICATION_ATTEMPT_FIELDS = gql`
  fragment DomainVerificationAttemptFields on DomainVerificationAttempt {
    id
    stage
    status
    message
    createdAt
  }
`

export const DOMAIN_CERTIFICATE_FIELDS = gql`
  fragment DomainCertificateFields on DomainCertificate {
    id
    certificateArn
    status
  }
`

export const DOMAIN_FULL_FIELDS = gql`
  ${DOMAIN_FIELDS}
  ${DOMAIN_VERIFICATION_RECORD_MAP_FIELDS}
  ${DOMAIN_VERIFICATION_ATTEMPT_FIELDS}
  ${DOMAIN_CERTIFICATE_FIELDS}
  fragment DomainFullFields on Domain {
    ...DomainFields
    records {
      ...DomainVerificationRecordMapFields
    }
    attempts {
      ...DomainVerificationAttemptFields
    }
    certificate {
      ...DomainCertificateFields
    }
  }
`

export const GET_DOMAIN = gql`
  ${DOMAIN_FULL_FIELDS}
  query Domain($subName: String!) {
    domain(subName: $subName) {
      ...DomainFullFields
    }
  }
`

export const GET_DOMAIN_MAPPING = gql`
  query DomainMapping($domainName: String!) {
    domainMapping(domainName: $domainName) {
      domainName
      subName
    }
  }
`

export const SET_DOMAIN = gql`
  mutation SetDomain($subName: String!, $domainName: String!) {
    setDomain(subName: $subName, domainName: $domainName) {
      domainName
    }
  }
`
