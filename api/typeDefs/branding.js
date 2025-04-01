import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    customBranding(subName: String!): CustomBranding
  }

  extend type Mutation {
    setCustomBranding(subName: String!, branding: CustomBrandingInput!): CustomBranding
  }

  type CustomBranding {
    title: String
    colors: JSONObject
    logoId: Int
    faviconId: Int
    subName: String
  }

  input CustomBrandingInput {
    title: String
    colors: JSONObject
    logoId: Int
    faviconId: Int
    subName: String
  }
`
