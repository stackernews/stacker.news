import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    snl: Boolean!
  }

  extend type Mutation {
    onAirToggle: Boolean!
    approveOAuthApplication(id: ID!): OAuthApplication!
  }
`
