import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    imageFees(s3Keys: [Int]!): Int!
  }
`
