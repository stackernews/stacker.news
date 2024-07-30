import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    price(fiatCurrency: String, changedCurrency: Boolean): Float
  }
`
