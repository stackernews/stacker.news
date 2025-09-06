import { gql } from '@apollo/client'
import { ITEM_FULL_FIELDS, POLL_FIELDS } from './items'
import { INVITE_FIELDS } from './invites'
import { SUB_FIELDS } from './subs'
import { PAY_IN_LINK_FIELDS } from './payIn'
export const HAS_NOTIFICATIONS = gql`{ hasNewNotes }`

export const PAY_INIFICATION = gql`
  ${ITEM_FULL_FIELDS}
  ${POLL_FIELDS}
  ${PAY_IN_LINK_FIELDS}
  fragment PayInificationFields on PayInification {
    id
    sortTime
    earnedSats
    payInItem {
      ...ItemFullFields
      ...PollFields
    }
    payIn {
      ...PayInLinkFields
    }
  }`

export const NOTIFICATIONS = gql`
  ${PAY_INIFICATION}
  ${INVITE_FIELDS}
  ${SUB_FIELDS}

  query Notifications($cursor: String, $inc: String) {
    notifications(cursor: $cursor, inc: $inc) {
      cursor
      lastChecked
      notifications {
        __typename
        ... on Mention {
          id
          sortTime
          mention
          item {
            ...ItemFullFields
            text
          }
        }
        ... on ItemMention {
          id
          sortTime
          item {
            ...ItemFullFields
            text
          }
        }
        ... on Votification {
          id
          sortTime
          earnedSats
          item {
            ...ItemFullFields
            text
          }
        }
        ... on Revenue {
          id
          sortTime
          earnedSats
          subName
        }
        ... on ForwardedVotification {
          id
          sortTime
          earnedSats
          item {
            ...ItemFullFields
            text
          }
        }
        ... on CowboyHat {
          id
          sortTime
          days
        }
        ... on NewHorse {
          id
          sortTime
        }
        ... on LostHorse {
          id
          sortTime
        }
        ... on NewGun {
          id
          sortTime
        }
        ... on LostGun {
          id
          sortTime
        }
        ... on Earn {
          id
          sortTime
          minSortTime
          earnedSats
          sources {
            posts
            comments
            tipPosts
            tipComments
          }
        }
        ... on ReferralReward {
          id
          sortTime
          earnedSats
          sources {
            forever
            oneDay
          }
        }
        ... on Referral {
          id
          sortTime
          source {
            __typename
            ... on Item {
              ...ItemFullFields
            }
            ... on Sub {
              ...SubFields
            }
            ... on User {
              name
            }
          }
        }
        ... on Reply {
          id
          sortTime
          item {
            ...ItemFullFields
            text
          }
        }
        ... on FollowActivity {
          id
          sortTime
          item {
            ...ItemFullFields
            text
          }
        }
        ... on TerritoryPost {
          id
          sortTime
          item {
            ...ItemFullFields
            text
          }
        }
        ... on TerritoryTransfer {
          id
          sortTime
          sub {
            ...SubFields
          }
        }
        ... on Invitification {
          id
          sortTime
          invite {
            ...InviteFields
          }
        }
        ... on JobChanged {
          id
          sortTime
          item {
            ...ItemFields
          }
        }
        ... on SubStatus {
          id
          sortTime
          sub {
            ...SubFields
          }
        }
        ... on PayInification {
          ...PayInificationFields
        }
        ... on Reminder {
          id
          sortTime
          item {
            ...ItemFullFields
          }
        }
      }
    }
  } `
