import { gql } from 'graphql-tag'

export const GET_CUSTOM_DOMAIN = gql`
  query CustomDomain($subName: String!) {
    customDomain(subName: $subName) {
      domain
      status
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
  }
`

export const GET_CUSTOM_DOMAIN_FULL = gql`
  ${GET_CUSTOM_DOMAIN}
  fragment CustomDomainFull on CustomDomain {
    ...CustomDomainFields
    failedAttempts
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
