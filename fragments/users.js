import { gql } from '@apollo/client'
import { COMMENTS, COMMENTS_ITEM_EXT_FIELDS } from './comments'
import { ITEM_FIELDS, ITEM_FULL_FIELDS } from './items'
import { SUB_FULL_FIELDS } from './subs'

export const STREAK_FIELDS = gql`
  fragment StreakFields on User {
    optional {
    streak
    gunStreak
      horseStreak
    }
  }
`

export const ME = gql`
${STREAK_FIELDS}
{
  me {
    id
    name
    bioId
    photoId
    privates {
      autoDropBolt11s
      diagnostics
      noReferralLinks
      fiatCurrency
      autoWithdrawMaxFeePercent
      autoWithdrawMaxBaseFee
      autoWithdrawThreshold
      withdrawMaxFeeDefault
      satsFilter
      hideFromTopUsers
      hideWalletBalance
      hideWelcomeBanner
      imgproxyOnly
      showImagesAndVideos
      nostrCrossposting
      sats
      tipDefault
      tipRandom
      tipRandomMin
      tipRandomMax
      tipPopover
      turboTipping
      zapUndos
      upvotePopover
      wildWestMode
      disableFreebies
    }
    optional {
      isContributor
      stacked
    }
    ...StreakFields
  }
}`

export const SETTINGS_FIELDS = gql`
  fragment SettingsFields on User {
    privates {
      tipDefault
      tipRandom
      tipRandomMin
      tipRandomMax
      turboTipping
      zapUndos
      fiatCurrency
      withdrawMaxFeeDefault
      noteItemSats
      noteEarning
      noteAllDescendants
      noteMentions
      noteItemMentions
      noteDeposits
      noteWithdrawals
      noteInvites
      noteJobIndicator
      noteCowboyHat
      noteForwardedSats
      hideInvoiceDesc
      autoDropBolt11s
      hideFromTopUsers
      hideCowboyHat
      hideBookmarks
      hideGithub
      hideNostr
      hideTwitter
      hideIsContributor
      imgproxyOnly
      showImagesAndVideos
      hideWalletBalance
      diagnostics
      noReferralLinks
      nostrPubkey
      nostrCrossposting
      nostrRelays
      wildWestMode
      satsFilter
      disableFreebies
      nsfwMode
      authMethods {
        lightning
        nostr
        github
        twitter
        email
        apiKey
      }
      apiKeyEnabled
    }
  }`

export const SETTINGS = gql`
  ${SETTINGS_FIELDS}
  query Settings {
    settings {
      ...SettingsFields
    }
  }`

export const SET_SETTINGS = gql`
  ${SETTINGS_FIELDS}
  mutation setSettings($settings: SettingsInput!) {
    setSettings(settings: $settings) {
      ...SettingsFields
    }
  }`

export const DELETE_WALLET = gql`
  mutation removeWallet {
    removeWallet
  }`

export const NAME_QUERY = gql`
  query nameAvailable($name: String!) {
    nameAvailable(name: $name)
  }`

export const NAME_MUTATION = gql`
  mutation setName($name: String!) {
    setName(name: $name)
  }
`

export const WELCOME_BANNER_MUTATION = gql`
  mutation hideWelcomeBanner {
    hideWelcomeBanner
  }
`

export const USER_SUGGESTIONS = gql`
  query userSuggestions($q: String!, $limit: Limit) {
    userSuggestions(q: $q, limit: $limit) {
      name
    }
  }`

export const USER_SEARCH = gql`
${STREAK_FIELDS}
  query searchUsers($q: String!, $limit: Limit, $similarity: Float) {
    searchUsers(q: $q, limit: $limit, similarity: $similarity) {
      id
      name
      photoId
      ncomments
      nposts

      optional {
        stacked
        spent
        referrals
      }
      ...StreakFields
    }
  }`

export const USER_FIELDS = gql`
  ${STREAK_FIELDS}
  fragment UserFields on User {
    id
    name
    since
    photoId
    nitems
    nterritories
    meSubscriptionPosts
    meSubscriptionComments
    meMute

    optional {
      stacked
      maxStreak
      isContributor
      githubId
      nostrAuthPubkey
      twitterId
    }
    ...StreakFields
  }`

export const MY_SUBSCRIBED_USERS = gql`
  ${STREAK_FIELDS}
  query MySubscribedUsers($cursor: String) {
    mySubscribedUsers(cursor: $cursor) {
      users {
        id
        name
        photoId
        meSubscriptionPosts
        meSubscriptionComments
        meMute

        ...StreakFields
      }
      cursor
    }
  }
`

export const MY_MUTED_USERS = gql`
  ${STREAK_FIELDS}
  query MyMutedUsers($cursor: String) {
    myMutedUsers(cursor: $cursor) {
      users {
        id
        name
        photoId
        meSubscriptionPosts
        meSubscriptionComments
        meMute
      ...StreakFields
      }
      cursor
    }
  }
`

export const TOP_USERS = gql`
  ${STREAK_FIELDS}
  query TopUsers($cursor: String, $when: String, $from: String, $to: String, $by: String, ) {
    topUsers(cursor: $cursor, when: $when, from: $from, to: $to, by: $by) {
      users {
        id
        name
        photoId
        ncomments(when: $when, from: $from, to: $to)
        nposts(when: $when, from: $from, to: $to)

        optional {
          stacked(when: $when, from: $from, to: $to)
          spent(when: $when, from: $from, to: $to)
          referrals(when: $when, from: $from, to: $to)
        }
        ...StreakFields
      }
      cursor
    }
  }
`

export const TOP_COWBOYS = gql`
  ${STREAK_FIELDS}
  query TopCowboys($cursor: String) {
    topCowboys(cursor: $cursor) {
      users {
        id
        name
        photoId
        ncomments(when: "forever")
        nposts(when: "forever")

        optional {
          stacked(when: "forever")
          spent(when: "forever")
          referrals(when: "forever")
        }
        ...StreakFields
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
  query User($id: ID, $name: String) {
    user(id: $id, name: $name) {
      ...UserFields
    }
  }`

export const USER_WITH_ITEMS = gql`
  ${USER_FIELDS}
  ${ITEM_FIELDS}
  ${COMMENTS_ITEM_EXT_FIELDS}
  query UserWithItems($name: String!, $sub: String, $cursor: String, $type: String, $when: String, $from: String, $to: String, $by: String, $limit: Limit, $includeComments: Boolean = false) {
    user(name: $name) {
      ...UserFields
    }
    items(sub: $sub, sort: "user", cursor: $cursor, type: $type, name: $name, when: $when, from: $from, to: $to, by: $by, limit: $limit) {
      cursor
      items {
        ...ItemFields
        ...CommentItemExtFields @include(if: $includeComments)
      }
    }
  }`

export const USER_WITH_SUBS = gql`
    ${USER_FIELDS}
    ${SUB_FULL_FIELDS}
    query UserWithSubs($name: String!, $cursor: String, $type: String, $when: String, $from: String, $to: String, $by: String) {
      user(name: $name) {
        ...UserFields
      }
      userSubs(name: $name, cursor: $cursor) {
        cursor
        subs {
          ...SubFullFields
          ncomments(when: "forever")
          nposts(when: "forever")

          optional {
            stacked(when: "forever")
            spent(when: "forever")
            revenue(when: "forever")
          }
        }
      }
    }`

export const USER_STATS = gql`
    query UserStats($when: String, $from: String, $to: String) {
      userStatsActions(when: $when, from: $from, to: $to) {
        time
        data {
          name
          value
        }
      }
      userStatsIncomingSats(when: $when, from: $from, to: $to) {
        time
        data {
          name
          value
        }
      }
      userStatsOutgoingSats(when: $when, from: $from, to: $to) {
        time
        data {
          name
          value
        }
      }
    }`
