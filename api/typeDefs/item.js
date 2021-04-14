import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    items: [Item!]!
    item(id: ID!): Item
    ncomments(id: ID!): [Item!]!
  }

  extend type Mutation {
    createLink(title: String!, url: String): Item!
    createDiscussion(title: String!, text: String): Item!
    createComment(text: String!, parentId: ID!): Item!
  }

  type Item {
    id: ID!
    createdAt: String!
    title: String
    url: String
    text: String
    parentId: Int
    user: User!
    depth: Int!
    sats: Int!
    ncomments: Int!
  }
`
