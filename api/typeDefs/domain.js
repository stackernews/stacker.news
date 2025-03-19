import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    customDomain(subName: String!): CustomDomain
  }

  extend type Mutation {
    setCustomDomain(subName: String!, domain: String!): CustomDomain
  }

  type CustomDomain {
    createdAt: Date!
    updatedAt: Date!
    domain: String!
    subName: String!
    dnsState: String
    sslState: String
    certificateArn: String
    lastVerifiedAt: Date
    verificationCname: String
    verificationCnameValue: String
    verificationTxt: String
  }
`
