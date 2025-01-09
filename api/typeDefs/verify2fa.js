import { gql } from 'graphql-tag'

export default gql`
  type Tokens2fa {
    key: String
    value: String
  }

  type Verify2faResponse {
    result: Boolean!
    tokens: [Tokens2fa]
    callbackUrl: String
  }

  extend type Mutation {
    verify2fa(method: String!, token: String!, callbackUrl: String): Verify2faResponse
  }
`
