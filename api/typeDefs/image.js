import { gql } from 'graphql-tag'

export default gql`
  type ImageFeesInfo {
    totalFees: Int!
    totalFeesMsats: Int!
    imageFee: Int!
    imageFeeMsats: Int!
    nUnpaid: Int!
    bytesUnpaid: Int!
    bytes24h: Int!
  }
  extend type Query {
    imageFeesInfo(s3Keys: [Int]!): ImageFeesInfo!
  }
`
