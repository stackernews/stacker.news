import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    snl: Boolean!
  }

  extend type Mutation {
    onAirToggle: Boolean!
  }
`
