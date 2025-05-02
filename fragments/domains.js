import { gql } from 'graphql-tag'

export const DOMAIN_FIELDS = gql`
  fragment DomainFields on Domain {
    domainName
    status
    subName
  }
`

export const DOMAIN_FULL_FIELDS = gql`
  ${DOMAIN_FIELDS}
  fragment DomainFullFields on Domain {
    ...DomainFields
    verifications {
      ...DomainVerificationFields
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
  query DomainMapping($domain: String!) {
    domainMapping(domain: $domain) {
      domain
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

export const DOMAIN_VERIFICATION_FIELDS = gql`
  fragment DomainVerificationFields on DomainVerification {
    createdAt
    updatedAt
    domainId
    type
    state
    host
    value
    sslArn
    lastCheckedAt
  }
`
