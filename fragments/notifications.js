import { gql } from '@apollo/client'
import { ITEM_FULL_FIELDS, POLL_FIELDS } from './items'
import { INVITE_FIELDS } from './invites'
import { SUB_FIELDS } from './subs'
import { PAY_IN_LINK_FIELDS } from './payIn'
export const HAS_NOTIFICATIONS = gql`{ hasNewNotes }`

export const PAY_IN_FAILED = gql`
  ${ITEM_FULL_FIELDS}
  ${POLL_FIELDS}
  ${PAY_IN_LINK_FIELDS}
  fragment PayInFailedFields on PayInFailed {
    id
    sortTime
    item {
      ...ItemFullFields
      ...PollFields
    }
    payIn {
      ...PayInLinkFields
    }
  }`

export const NOTIFICATIONS = gql`
  ${PAY_IN_FAILED}
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
        ... on InvoicePaid {
          id
          sortTime
          earnedSats
          invoice {
            id
            nostr
            comment
            lud18Data
            actionType
            forwardedSats
          }
        }
        ... on PayInFailed {
          ...PayInFailedFields
        }
        ... on WithdrawlPaid {
          id
          sortTime
          earnedSats
          withdrawl {
            autoWithdraw
            satsFeePaid
            forwardedActionType
          }
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
