import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    moreItems(sort: String!, cursor: String, userId: ID): Items
    item(id: ID!): Item
    userComments(userId: ID!): [Item!]
    root(id: ID!): Item
  }

  extend type Mutation {
    createLink(title: String!, url: String): Item!
    createDiscussion(title: String!, text: String): Item!
    createComment(text: String!, parentId: ID!): Item!
    vote(id: ID!, sats: Int): Int!
  }

  type Items {
    cursor: String
    items: [Item!]!
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
    boost: Int!
    meSats: Int!
    ncomments: Int!
    comments: [Item!]!
  }
`
