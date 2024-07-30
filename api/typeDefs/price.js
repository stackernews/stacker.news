import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    price(fiatCurrency: String, fromCache: Boolean = true): Float
  }
`
