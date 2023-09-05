import { gql } from 'graphql-tag'

export default gql`
  type ItemForward {
    id: ID!
    created_at: Date!
    updated_at: Date!
    itemId: Int!
    userId: Int!
    user: User!
    pct: Int!
  }
`
