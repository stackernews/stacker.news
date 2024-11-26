import { gql } from 'graphql-tag'

export default gql`

  extend type Query {
    fetchEmbedMeta(source: String!): JSONObject
  }

`
