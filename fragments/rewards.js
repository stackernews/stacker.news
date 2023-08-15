import gql from 'graphql-tag'

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
  query meRewards($when: String) {
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
      }
    }
  }`
