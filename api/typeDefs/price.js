import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    price(fiatCurrency: String): Float
  }
`
