import { gql } from 'graphql-tag'

export default gql`

  extend type Query {
    fetchEmbedMeta(provider: String!, args: JSONObject!): JSONObject
  }

`
