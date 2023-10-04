import { gql } from '@apollo/client'
import { COMMENTS, COMMENTS_ITEM_EXT_FIELDS } from './comments'
import { ITEM_FIELDS, ITEM_FULL_FIELDS } from './items'

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
      nostrCrossposting
      noteItemSats
      noteEarning
      noteAllDescendants
      noteMentions
      noteDeposits
      noteInvites
      noteJobIndicator
      noteCowboyHat
      noteForwardedSats
      hideInvoiceDesc
      hideFromTopUsers
      hideCowboyHat
      imgproxyOnly
      diagnostics
      wildWestMode
      greeterMode
      lastCheckedJobs
      hideWelcomeBanner
      hideWalletBalance
      isContributor
      hideIsContributor
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
    noteForwardedSats
    hideInvoiceDesc
    hideFromTopUsers
    hideCowboyHat
    hideBookmarks
    hideIsContributor
    imgproxyOnly
    hideWalletBalance
    diagnostics
    nostrPubkey
    nostrCrossposting
    nostrRelays
    wildWestMode
    greeterMode
    authMethods {
      lightning
      nostr
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
  $hideFromTopUsers: Boolean!, $hideCowboyHat: Boolean!, $imgproxyOnly: Boolean!,
  $wildWestMode: Boolean!, $greeterMode: Boolean!, $nostrPubkey: String, $nostrCrossposting: Boolean!, $nostrRelays: [String!], $hideBookmarks: Boolean!,
  $noteForwardedSats: Boolean!, $hideWalletBalance: Boolean!, $hideIsContributor: Boolean!, $diagnostics: Boolean!) {
  setSettings(tipDefault: $tipDefault, turboTipping: $turboTipping,  fiatCurrency: $fiatCurrency,
    noteItemSats: $noteItemSats, noteEarning: $noteEarning, noteAllDescendants: $noteAllDescendants,
    noteMentions: $noteMentions, noteDeposits: $noteDeposits, noteInvites: $noteInvites,
    noteJobIndicator: $noteJobIndicator, noteCowboyHat: $noteCowboyHat, hideInvoiceDesc: $hideInvoiceDesc,
    hideFromTopUsers: $hideFromTopUsers, hideCowboyHat: $hideCowboyHat, imgproxyOnly: $imgproxyOnly,
    wildWestMode: $wildWestMode, greeterMode: $greeterMode, nostrPubkey: $nostrPubkey, nostrCrossposting: $nostrCrossposting, nostrRelays: $nostrRelays, hideBookmarks: $hideBookmarks,
    noteForwardedSats: $noteForwardedSats, hideWalletBalance: $hideWalletBalance, hideIsContributor: $hideIsContributor, diagnostics: $diagnostics) {
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

export const WELCOME_BANNER_MUTATION =
gql`
  mutation hideWelcomeBanner {
    hideWelcomeBanner
  }
`

export const USER_SEARCH =
gql`
  query searchUsers($q: String!, $limit: Int, $similarity: Float) {
    searchUsers(q: $q, limit: $limit, similarity: $similarity) {
      id
      name
      streak
      hideCowboyHat
      photoId
      stacked
      spent
      ncomments
      nposts
      referrals
    }
  }`

export const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    name
    streak
    maxStreak
    hideCowboyHat
    nitems
    stacked
    since
    photoId
    isContributor
    meSubscriptionPosts
    meSubscriptionComments
    meMute
  }`

export const TOP_USERS = gql`
  query TopUsers($cursor: String, $when: String, $by: String) {
    topUsers(cursor: $cursor, when: $when, by: $by) {
      users {
        id
        name
        streak
        hideCowboyHat
        photoId
        stacked(when: $when)
        spent(when: $when)
        ncomments(when: $when)
        nposts(when: $when)
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
        id
        name
        streak
        hideCowboyHat
        photoId
        stacked(when: "forever")
        spent(when: "forever")
        ncomments(when: "forever")
        nposts(when: "forever")
        referrals(when: "forever")
      }
      cursor
    }
  }
`

export const USER_FULL = gql`
  ${USER_FIELDS}
  ${ITEM_FULL_FIELDS}
  ${COMMENTS}
  query User($name: String!, $sort: String) {
    user(name: $name) {
      ...UserFields
      bio {
        ...ItemFullFields
        comments(sort: $sort) {
          ...CommentsRecursive
        }
      }
  }
}`

export const USER = gql`
  ${USER_FIELDS}
  query User($name: String!) {
    user(name: $name) {
      ...UserFields
    }
  }`

export const USER_WITH_ITEMS = gql`
  ${USER_FIELDS}
  ${ITEM_FIELDS}
  ${COMMENTS_ITEM_EXT_FIELDS}
  query UserWithItems($name: String!, $sub: String, $cursor: String, $type: String, $when: String, $by: String, $limit: Int, $includeComments: Boolean = false) {
    user(name: $name) {
      ...UserFields
    }
    items(sub: $sub, sort: "user", cursor: $cursor, type: $type, name: $name, when: $when, by: $by, limit: $limit) {
      cursor
      items {
        ...ItemFields
        ...CommentItemExtFields @include(if: $includeComments)
      }
    }
  }`
