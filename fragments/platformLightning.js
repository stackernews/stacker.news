import { gql } from '@apollo/client'

export const PLATFORM_LIGHTNING_STATUS = gql`
  query PlatformLightningStatus {
    platformLightningStatus {
      available
      message
    }
  }
`
