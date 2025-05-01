import { gql } from 'graphql-tag'

export const CUSTOM_DOMAIN_FIELDS = gql`
  fragment CustomDomainFields on CustomDomain {
    domain
    status
  }
`

export const CUSTOM_DOMAIN_FULL_FIELDS = gql`
  ${CUSTOM_DOMAIN_FIELDS}
  fragment CustomDomainFullFields on CustomDomain {
    ...CustomDomainFields
    lastVerifiedAt
    verification {
      dns {
        state
        cname
        txt
      }
      ssl {
        state
        arn
        cname
        value
      }
    }
  }
`

export const GET_CUSTOM_DOMAIN = gql`
  ${CUSTOM_DOMAIN_FULL_FIELDS}
  query CustomDomain($subName: String!) {
    customDomain(subName: $subName) {
      ...CustomDomainFullFields
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

export const SET_CUSTOM_DOMAIN = gql`
  mutation SetCustomDomain($subName: String!, $domain: String!) {
    setCustomDomain(subName: $subName, domain: $domain) {
      domain
      verification {
        dns {
          state
          cname
          txt
        }
        ssl {
          state
          arn
          cname
          value
        }
      }
    }
  }
`
