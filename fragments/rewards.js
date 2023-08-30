import gql from 'graphql-tag'
import { ITEM_FULL_FIELDS } from './items'

export const REWARDS = gql`
  query rewards($when: String) {
    rewards(when: $when) {
      total
      time
      sources {
        name
        value
      }
    }
  }`

export const ME_REWARDS = gql`
  ${ITEM_FULL_FIELDS}
  query meRewards($when: [String!]) {
    rewards(when: $when) {
      total
      time
      sources {
        name
        value
      }
    }
    meRewards(when: $when) {
      total
      rewards {
        type
        rank
        sats
        item {
          ...ItemFullFields
          text
        }
      }
    }
  }`
