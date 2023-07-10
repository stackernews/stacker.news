import { gql } from '@apollo/client'
import { COMMENT_FIELDS } from './comments'
import { ITEM_FIELDS, ITEM_FULL_FIELDS, ITEM_WITH_COMMENTS } from './items'

export const ME = gql`
  {
    me {
      id
      name
      streak
      sats
      stacked
      freePosts
      freeComments
      tipDefault
      turboTipping
      fiatCurrency
      bioId
      upvotePopover
      tipPopover
      noteItemSats
      noteEarning
      noteAllDescendants
      noteMentions
      noteDeposits
      noteInvites
      noteJobIndicator
      noteCowboyHat
      hideInvoiceDesc
      hideFromTopUsers
      hideCowboyHat
      wildWestMode
      greeterMode
      lastCheckedJobs
    }
  }`

export const SETTINGS_FIELDS = gql`
  fragment SettingsFields on User {
    tipDefault
    turboTipping
    fiatCurrency
    noteItemSats
    noteEarning
    noteAllDescendants
    noteMentions
    noteDeposits
    noteInvites
    noteJobIndicator
    noteCowboyHat
    hideInvoiceDesc
    hideFromTopUsers
    hideCowboyHat
    nostrPubkey
    nostrRelays
    wildWestMode
    greeterMode
    authMethods {
      lightning
      slashtags
      github
      twitter
      email
    }
  }`

export const SETTINGS = gql`
${SETTINGS_FIELDS}
{
  settings {
    ...SettingsFields
  }
}`

export const SET_SETTINGS =
gql`
${SETTINGS_FIELDS}
mutation setSettings($tipDefault: Int!, $turboTipping: Boolean!, $fiatCurrency: String!, $noteItemSats: Boolean!,
  $noteEarning: Boolean!, $noteAllDescendants: Boolean!, $noteMentions: Boolean!, $noteDeposits: Boolean!,
  $noteInvites: Boolean!, $noteJobIndicator: Boolean!, $noteCowboyHat: Boolean!, $hideInvoiceDesc: Boolean!,
  $hideFromTopUsers: Boolean!, $hideCowboyHat: Boolean!,
  $wildWestMode: Boolean!, $greeterMode: Boolean!, $nostrPubkey: String, $nostrRelays: [String!]) {
  setSettings(tipDefault: $tipDefault, turboTipping: $turboTipping,  fiatCurrency: $fiatCurrency,
    noteItemSats: $noteItemSats, noteEarning: $noteEarning, noteAllDescendants: $noteAllDescendants,
    noteMentions: $noteMentions, noteDeposits: $noteDeposits, noteInvites: $noteInvites,
    noteJobIndicator: $noteJobIndicator, noteCowboyHat: $noteCowboyHat, hideInvoiceDesc: $hideInvoiceDesc,
    hideFromTopUsers: $hideFromTopUsers, hideCowboyHat: $hideCowboyHat,
    wildWestMode: $wildWestMode, greeterMode: $greeterMode, nostrPubkey: $nostrPubkey, nostrRelays: $nostrRelays) {
      ...SettingsFields
    }
  }
`

export const NAME_QUERY =
gql`
  query nameAvailable($name: String!) {
    nameAvailable(name: $name)
  }
`

export const NAME_MUTATION =
gql`
  mutation setName($name: String!) {
    setName(name: $name)
  }
`

export const USER_SEARCH =
gql`
  query searchUsers($q: String!, $limit: Int, $similarity: Float) {
    searchUsers(q: $q, limit: $limit, similarity: $similarity) {
      name
      streak
      hideCowboyHat
      photoId
      stacked
      spent
      ncomments
      nitems
      referrals
    }
  }`

export const USER_FIELDS = gql`
  ${ITEM_FIELDS}
  fragment UserFields on User {
    id
    createdAt
    name
    streak
    hideCowboyHat
    nitems
    ncomments
    nbookmarks
    stacked
    sats
    photoId
    bio {
      ...ItemFields
      text
    }
  }`

export const TOP_USERS = gql`
  query TopUsers($cursor: String, $when: String, $sort: String) {
    topUsers(cursor: $cursor, when: $when, sort: $sort) {
      users {
        name
        streak
        hideCowboyHat
        photoId
        stacked(when: $when)
        spent(when: $when)
        ncomments(when: $when)
        nitems(when: $when)
        referrals(when: $when)
      }
      cursor
    }
  }
`

export const TOP_COWBOYS = gql`
  query TopCowboys($cursor: String) {
    topCowboys(cursor: $cursor) {
      users {
        name
        streak
        hideCowboyHat
        photoId
        stacked(when: "forever")
        spent(when: "forever")
        ncomments(when: "forever")
        nitems(when: "forever")
        referrals(when: "forever")
      }
      cursor
    }
  }
`

export const USER_FULL = gql`
  ${USER_FIELDS}
  ${ITEM_WITH_COMMENTS}
  query User($name: String!) {
    user(name: $name) {
      ...UserFields
      since
      bio {
        ...ItemWithComments
      }
  }
}`

export const USER_WITH_COMMENTS = gql`
  ${USER_FIELDS}
  ${COMMENT_FIELDS}
  query UserWithComments($name: String!) {
    user(name: $name) {
      ...UserFields
      since
    }
    moreFlatComments(sort: "user", name: $name) {
      cursor
      comments {
        ...CommentFields
        root {
          id
          title
          bounty
          bountyPaidTo
          subName
          user {
            name
            streak
            hideCowboyHat
            id
          }
        }
      }
    }
  }`

export const USER_WITH_BOOKMARKS = gql`
  ${USER_FIELDS}
  ${ITEM_FULL_FIELDS}
  query UserWithBookmarks($name: String!, $cursor: String) {
    user(name: $name) {
      ...UserFields
      since
    }
    moreBookmarks(name: $name, cursor: $cursor) {
      cursor
      items {
        ...ItemFullFields
      }
    }
  }
`

export const USER_WITH_POSTS = gql`
  ${USER_FIELDS}
  ${ITEM_FIELDS}
  query UserWithPosts($name: String!) {
    user(name: $name) {
      ...UserFields
      since
    }
    items(sort: "user", name: $name) {
      cursor
      items {
        ...ItemFields
      }
      pins {
        ...ItemFields
      }
    }
  }`
