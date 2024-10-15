import { gql } from 'graphql-tag'

export default gql`
  type UploadFees {
    totalFees: Int!
    totalFeesMsats: Int!
    uploadFees: Int!
    uploadFeesMsats: Int!
    nUnpaid: Int!
    bytesUnpaid: Int!
    bytes24h: Int!
  }

  type SignedPost {
    url: String!
    fields: JSONObject!
  }

  extend type Query {
    uploadFees(s3Keys: [Int]!): UploadFees!
  }

  extend type Mutation {
    getSignedPOST(type: String!, size: Int!, width: Int!, height: Int!, avatar: Boolean): SignedPost!
  }
`
