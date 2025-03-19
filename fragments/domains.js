import { gql } from 'graphql-tag'

export const GET_CUSTOM_DOMAIN = gql`
  query CustomDomain($subName: String!) {
    customDomain(subName: $subName) {
      domain
      dnsState
      sslState
      verificationCname
      verificationCnameValue
      verificationTxt
      lastVerifiedAt
    }
  }
`

export const GET_CUSTOM_DOMAIN_FULL = gql`
  ${GET_CUSTOM_DOMAIN}
  fragment CustomDomainFull on CustomDomain {
    ...CustomDomainFields
    certificateArn
  }
`

export const SET_CUSTOM_DOMAIN = gql`
  mutation SetCustomDomain($subName: String!, $domain: String!) {
    setCustomDomain(subName: $subName, domain: $domain) {
      domain
      dnsState
      sslState
    }
  }
`
