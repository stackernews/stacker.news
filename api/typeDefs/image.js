import { gql } from 'graphql-tag'

export default gql`
  type ImageFees {
    fees: Int!
    unpaid: Int!
    feesPerImage: Int!
    sizeNow: Int!
    size24h: Int!
  }
  extend type Query {
    imageFees(s3Keys: [Int]!): ImageFees!
  }
`
