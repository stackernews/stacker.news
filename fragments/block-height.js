import { gql } from '@apollo/client'

export const BLOCK_HEIGHT = gql`
  query blockHeight {
    blockHeight
  }`
