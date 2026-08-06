import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    platformLightningStatus: PlatformLightningStatus!
  }

  type PlatformLightningStatus {
    available: Boolean!
    message: String
  }
`
