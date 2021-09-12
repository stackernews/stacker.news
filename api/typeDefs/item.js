import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    moreItems(sort: String!, cursor: String, userId: ID): Items
    moreFlatComments(cursor: String, userId: ID): Comments
    item(id: ID!): Item
    userComments(userId: ID!): [Item!]
    pageTitle(url: String!): String
  }

  enum ItemAct {
    VOTE
    BOOST
    TIP
  }

  type ItemActResult {
    sats: Int!
    act: ItemAct!
  }

  extend type Mutation {
    createLink(title: String!, url: String, boost: Int): Item!
    updateLink(id: ID!, title: String!, url: String): Item!
    createDiscussion(title: String!, text: String, boost: Int): Item!
    updateDiscussion(id: ID!, title: String!, text: String): Item!
    createComment(text: String!, parentId: ID!): Item!
    updateComment(id: ID!, text: String!): Item!
    act(id: ID!, act: ItemAct!, sats: Int, tipDefault: Boolean): ItemActResult!
  }

  type Items {
    cursor: String
    items: [Item!]!
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
    sats: Int!
    boost: Int!
    tips: Int!
    meVote: Int!
    meBoost: Int!
    meTip: Int!
    ncomments: Int!
    comments: [Item!]!
    path: String
  }
`
