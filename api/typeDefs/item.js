import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    moreItems(sort: String!, cursor: String, name: String, within: String): Items
    moreFlatComments(sort: String!, cursor: String, name: String, within: String): Comments
    item(id: ID!): Item
    comments(id: ID!, sort: String): [Item!]!
    pageTitle(url: String!): String
    dupes(url: String!): [Item!]
  }

  type ItemActResult {
    vote: Int!
    sats: Int!
  }

  extend type Mutation {
    createLink(title: String!, url: String, boost: Int): Item!
    updateLink(id: ID!, title: String!, url: String): Item!
    createDiscussion(title: String!, text: String, boost: Int): Item!
    updateDiscussion(id: ID!, title: String!, text: String): Item!
    createComment(text: String!, parentId: ID!): Item!
    updateComment(id: ID!, text: String!): Item!
    act(id: ID!, sats: Int): ItemActResult!
  }

  type Items {
    cursor: String
    items: [Item!]!
    pins: [Item!]
  }

  type Comments {
    cursor: String
    comments: [Item!]!
  }

  type Item {
    id: ID!
    createdAt: String!
    title: String
    url: String
    text: String
    parentId: Int
    parent: Item
    root: Item
    user: User!
    depth: Int!
    mine: Boolean!
    boost: Int!
    sats: Int!
    upvotes: Int!
    meSats: Int!
    ncomments: Int!
    comments: [Item!]!
    path: String
    position: Int
    prior: Int
  }
`
