import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    items: [Item!]!
  }

  extend type Mutation {
    createItem(text: String!, parentId: ID): Item!
  }

  type Item {
    id: ID!
    text: String!
    user: User!
    depth: Int!
  }
`
