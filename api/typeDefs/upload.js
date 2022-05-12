import { gql } from 'apollo-server-micro'

export default gql`
  scalar JSONObject

  extend type Mutation {
    getSignedPOST(type: String!, size: Int!, width: Int!, height: Int!): SignedPost!
  }

  type SignedPost {
    url: String!
    fields: JSONObject!
  }
`
